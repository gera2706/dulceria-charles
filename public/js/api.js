/* ================================================================
   ARCHIVO: js/api.js
   PROPÓSITO: Capa de comunicación entre el frontend y el servidor.

   ¿POR QUÉ TENER ESTE ARCHIVO SEPARADO?
   En lugar de escribir fetch() directamente en cada página, todas
   las llamadas al servidor pasan por aquí. Esto tiene varias ventajas:
   - Si cambia la URL del servidor, solo lo cambiamos en un lugar
   - El token JWT se agrega automáticamente a TODAS las peticiones
   - Los errores se manejan de forma uniforme
   - El código de cada página es más limpio y legible

   ¿CÓMO FUNCIONA EL SISTEMA DE AUTENTICACIÓN?
   1. Usuario hace login → servidor devuelve un TOKEN (cadena de texto)
   2. Guardamos el token en sessionStorage del navegador
   3. En cada petición posterior, enviamos el token en el header:
      Authorization: Bearer eyJhbGci...
   4. El servidor verifica el token y sabe quién es el usuario
   5. Al cerrar sesión, borramos el token del navegador

   POR QUÉ SIEMPRE sessionStorage Y NO localStorage:
   localStorage persiste aunque se cierre el navegador — en una
   computadora compartida, cualquiera que la use después seguiría
   con la sesión abierta. Por seguridad, la sesión siempre se guarda
   en sessionStorage (se borra al cerrar la pestaña/navegador) y hay
   que volver a iniciar sesión cada vez. Lo único que el checkbox
   "Recuérdame" del login guarda es el correo (ver login.html), para
   no tener que volver a escribirlo — nunca la contraseña.
   (getToken()/getCurrentUser() siguen revisando localStorage también,
   solo para no cerrarle la sesión de golpe a alguien que ya la tenía
   guardada ahí de antes de este cambio.)
================================================================ */

const API_BASE = '/api';
// Prefijo de todas las rutas del servidor.
// Al usar '/' relativo (sin http://), automáticamente apunta al mismo
// servidor donde está el frontend (localhost:3000 en desarrollo).

/* ================================================================
   MANEJO DEL TOKEN JWT EN EL NAVEGADOR
================================================================ */

/* Lee el token guardado. Revisa localStorage solo por compatibilidad
   con sesiones guardadas ahí antes de este cambio (ver nota arriba);
   las sesiones nuevas siempre quedan en sessionStorage. */
function getToken() {
  return localStorage.getItem('dc_token') || sessionStorage.getItem('dc_token') || null;
}

/* Guarda el token en sessionStorage (se borra al cerrar el navegador) */
function saveToken(token) {
  sessionStorage.setItem('dc_token', token);
  localStorage.removeItem('dc_token'); // por si tenía una sesión persistente de antes de este cambio
}

/* Borra el token de ambos storages. Se llama al cerrar sesión. */
function removeToken() {
  localStorage.removeItem('dc_token');
  sessionStorage.removeItem('dc_token');
}

/* ================================================================
   FUNCIÓN BASE: apiFetch
   Es el "motor" de toda la comunicación con el servidor.
   Todas las funciones apiXxx() la usan internamente.

   ¿QUÉ HACE EXACTAMENTE?
   1. Lee el token guardado en el navegador
   2. Arma los headers de la petición (tipo de contenido + token)
   3. Hace la petición HTTP al servidor con fetch()
   4. Convierte la respuesta de JSON a objeto JavaScript
   5. Si el servidor respondió con error, lanza una excepción
   6. Si todo está bien, devuelve los datos

   ¿POR QUÉ async/await?
   Las peticiones de red NO son instantáneas. async/await permite
   "esperar" la respuesta sin bloquear el navegador, de forma más
   legible que los callbacks o .then() encadenados.
================================================================ */
async function apiFetch(endpoint, options = {}) {
  const token = getToken();

  // Preparamos los headers de la petición
  const headers = {
    'Content-Type': 'application/json', // le decimos al servidor que mandamos JSON
    ...(options.headers || {})           // si la función llamante agregó headers extra, los incluimos
  };

  // Si el usuario está logueado, enviamos su token para identificarnos
  if (token) headers['Authorization'] = 'Bearer ' + token;
  // "Bearer" es el estándar para tokens JWT. El servidor espera este formato.

  // Hacemos la petición HTTP al servidor
  const res = await fetch(API_BASE + endpoint, { ...options, headers });
  // fetch() devuelve una Promise. Con await la "esperamos" sin bloquear.
  // El spread ...options copia todas las opciones que nos pasaron (method, body, etc.)

  // Intentamos parsear la respuesta como JSON
  const data = await res.json().catch(() => ({}));
  // Si el servidor devolvió algo que no es JSON válido, usamos objeto vacío
  // en lugar de dejar que el error rompa todo.

  // Si el servidor devolvió un código de error (4xx o 5xx), lanzamos excepción
  if (!res.ok) throw new Error(data.error || 'Error en el servidor');
  // res.ok es true cuando el código HTTP es 200-299
  // throw detiene la ejecución y el catch() del código que llamó apiFetch lo captura

  return data; // todo bien, devolvemos los datos
}

/* ================================================================
   AUTENTICACIÓN
================================================================ */

/* Inicia sesión. Si tiene éxito:
   - Guarda el token en el storage
   - Migra el carrito y favoritos del visitante a la cuenta del usuario
   - Devuelve los datos del usuario */
async function apiLogin(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
    // JSON.stringify convierte el objeto JS a texto JSON para enviarlo
  });
  saveToken(data.token);
  _saveSession(data.user);

  // Si el visitante tenía carrito guardado en sessionStorage,
  // lo fusionamos con su carrito de usuario registrado
  if (typeof migrateCartOnLogin     === 'function') migrateCartOnLogin();
  if (typeof migrateFavoritesOnLogin === 'function') await migrateFavoritesOnLogin();
  // typeof verifica que la función exista antes de llamarla
  // (se define en cart.js que carga junto con este archivo)

  return data.user;
}

/* Registra una cuenta nueva. Misma lógica que apiLogin después del registro. */
async function apiRegistro(nombre, email, password) {
  const data = await apiFetch('/auth/registro', {
    method: 'POST',
    body: JSON.stringify({ nombre, email, password })
  });
  saveToken(data.token);
  _saveSession(data.user);
  if (typeof migrateCartOnLogin     === 'function') migrateCartOnLogin();
  if (typeof migrateFavoritesOnLogin === 'function') await migrateFavoritesOnLogin();
  return data.user;
}

/* Pide el correo de recuperación de contraseña. No requiere sesión
   (es justo para cuando NO se puede iniciar sesión). El backend
   responde { ok:true } exista o no la cuenta, así que del lado del
   frontend no hay nada que distinguir — siempre se muestra el mismo
   mensaje de éxito. */
async function apiOlvidePassword(email) {
  return apiFetch('/auth/olvide-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

/* Segundo paso: cambia la contraseña usando el token que llegó por
   correo (en la URL de resetear-password.html). Si el token es
   inválido o ya expiró, apiFetch lanza el error tal cual lo mandó
   el servidor. */
async function apiResetearPassword(token, passwordNueva) {
  return apiFetch('/auth/resetear-password', {
    method: 'POST',
    body: JSON.stringify({ token, passwordNueva })
  });
}

/* Actualiza el nombre/email (y opcionalmente la contraseña) del
   usuario logueado. El servidor devuelve un token NUEVO ya con los
   datos actualizados; lo guardamos igual que en login/registro para
   que el saludo del menú se actualice sin tener que cerrar sesión. */
async function apiActualizarPerfil(datos) {
  const data = await apiFetch('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(datos)
  });
  saveToken(data.token);
  _saveSession(data.user);
  return data.user;
}

/* Cierra la sesión: borra todos los datos del usuario del navegador
   y redirige al inicio. No necesita llamar al servidor. */
function apiLogout() {
  removeToken();
  localStorage.removeItem('dc_session');
  sessionStorage.removeItem('dc_session');
  window.location.href = 'index.html';
}

/* ================================================================
   PRODUCTOS
================================================================ */

/* Obtiene productos del catálogo. Acepta filtros opcionales.
   Ejemplos de uso:
   apiGetProductos()                          → todos los productos
   apiGetProductos({ categoria: 'gomitas' })  → solo gomitas
   apiGetProductos({ destacado: true })       → solo destacados
   apiGetProductos({ q: 'paleta' })           → busca por nombre */
async function apiGetProductos(filtros = {}) {
  const params = new URLSearchParams();
  // URLSearchParams construye el string de parámetros de forma segura
  // Ejemplo: { categoria: 'gomitas', q: 'osito' } → "categoria=gomitas&q=osito"

  if (filtros.categoria) params.set('categoria', filtros.categoria);
  if (filtros.destacado) params.set('destacado', '1');
  if (filtros.q)         params.set('q', filtros.q);

  const qs = params.toString(); // convierte a string
  return apiFetch('/productos' + (qs ? '?' + qs : ''));
  // Si hay filtros: /productos?categoria=gomitas
  // Si no hay filtros: /productos
}

async function apiGetProducto(id)        { return apiFetch('/productos/' + id); }
async function apiCrearProducto(datos)   { return apiFetch('/productos',      { method: 'POST',   body: JSON.stringify(datos) }); }
async function apiEditarProducto(id, datos) { return apiFetch('/productos/' + id, { method: 'PUT', body: JSON.stringify(datos) }); }
async function apiEliminarProducto(id)   { return apiFetch('/productos/' + id, { method: 'DELETE' }); }

/* Ajuste rápido de inventario: delta positivo suma, negativo resta.
   Usado por los botones +/- de la tabla de Productos (admin). */
async function apiAjustarStock(id, delta) {
  return apiFetch('/productos/' + id + '/stock', { method: 'PATCH', body: JSON.stringify({ delta }) });
}

/* Papelera: productos con soft-delete (activo=0) y su reactivación. */
async function apiGetPapelera()          { return apiFetch('/productos/papelera'); }
async function apiReactivarProducto(id)  { return apiFetch('/productos/' + id + '/reactivar', { method: 'PATCH' }); }

/* Marcar/desmarcar destacado con un clic (columna "Dest." del admin). */
async function apiToggleDestacado(id, destacado) {
  return apiFetch('/productos/' + id + '/destacado', { method: 'PATCH', body: JSON.stringify({ destacado }) });
}

/* ================================================================
   PEDIDOS
================================================================ */

async function apiCrearPedido(datos) {
  return apiFetch('/pedidos', { method: 'POST', body: JSON.stringify(datos) });
}

/* Guarda pedido incompleto al entrar a pago.html */
async function apiPedidoInconcluso(datos) {
  return apiFetch('/pedidos/inconcluso', { method: 'POST', body: JSON.stringify(datos) });
}

/* Completa un pedido inconcluso con datos de envío y pago */
async function apiCompletarPedido(id, datos) {
  return apiFetch('/pedidos/' + id + '/completar', { method: 'PUT', body: JSON.stringify(datos) });
}

/* Mis pedidos (para la página pedidos.html del cliente) */
async function apiGetMisPedidos() { return apiFetch('/pedidos/mios'); }

/* Un pedido específico por ID (para comprobante.html) */
async function apiGetPedido(id) { return apiFetch('/pedidos/' + id); }

/* Todos los pedidos (para el panel admin) */
async function apiGetTodosPedidos() { return apiFetch('/pedidos'); }

/* Cambia el estado de un pedido desde el admin. motivo es opcional —
   solo se usa (y solo importa) cuando estado es 'cancelado', para
   avisarle al cliente por qué (ver PATCH /:id/estado en pedidos.js). */
async function apiCambiarEstadoPedido(id, estado, motivo) {
  return apiFetch('/pedidos/' + id + '/estado', {
    method: 'PATCH',
    body: JSON.stringify({ estado, motivo })
  });
}

/* Cliente con un pedido incompleto avisa al dueño que un producto ya
   se agotó (ver pedidos.html → js/pedidos.js). */
async function apiAvisarAgotado(pedidoId, productoId) {
  return apiFetch('/pedidos/' + pedidoId + '/avisar-agotado', {
    method: 'POST',
    body: JSON.stringify({ producto_id: productoId })
  });
}

/* El cliente cancela su propio pedido (a diferencia de
   apiCambiarEstadoPedido, que es solo para el admin). motivo es
   obligatorio — el backend lo rechaza si viene vacío. */
async function apiCancelarPedido(id, motivo) {
  return apiFetch('/pedidos/' + id + '/cancelar', {
    method: 'POST',
    body: JSON.stringify({ motivo })
  });
}

/* ================================================================
   FAVORITOS
================================================================ */

async function apiGetFavoritos()              { return apiFetch('/favoritos'); }
async function apiAgregarFavorito(productoId) { return apiFetch('/favoritos/' + productoId, { method: 'POST' }); }
async function apiQuitarFavorito(productoId)  { return apiFetch('/favoritos/' + productoId, { method: 'DELETE' }); }

/* ================================================================
   USUARIOS (solo para el panel admin)
================================================================ */

async function apiGetUsuarios()                 { return apiFetch('/usuarios'); }
async function apiCambiarRolUsuario(id, rol)    { return apiFetch('/usuarios/' + id + '/rol',  { method: 'PATCH',  body: JSON.stringify({ rol }) }); }
async function apiEliminarUsuario(id)           { return apiFetch('/usuarios/' + id,           { method: 'DELETE' }); }

/* ================================================================
   CATEGORÍAS
================================================================ */

async function apiGetCategorias()              { return apiFetch('/categorias'); }
async function apiCrearCategoria(nombre, icono)        { return apiFetch('/categorias',       { method: 'POST', body: JSON.stringify({ nombre, icono: icono || '🍬' }) }); }
async function apiEditarCategoria(id, nombre, icono)   { return apiFetch('/categorias/' + id,  { method: 'PUT',  body: JSON.stringify({ nombre, icono: icono || '🍬' }) }); }
async function apiEliminarCategoria(id)        { return apiFetch('/categorias/' + id, { method: 'DELETE' }); }

/* ================================================================
   CHATBOT DEL SITIO: PREGUNTAS FRECUENTES
   Ver backend/routes/chatbot_faq.js y la sección "CHATBOT DEL SITIO"
   en cart.js (que consume apiGetChatbotFaqs).
================================================================ */

async function apiGetChatbotFaqs()             { return apiFetch('/chatbot-faq'); }              // públicas (activas)
async function apiGetChatbotFaqsAdmin()        { return apiFetch('/chatbot-faq/admin'); }         // todas, solo admin
async function apiCrearChatbotFaq(datos)       { return apiFetch('/chatbot-faq',      { method: 'POST', body: JSON.stringify(datos) }); }
async function apiEditarChatbotFaq(id, datos)  { return apiFetch('/chatbot-faq/' + id, { method: 'PUT',  body: JSON.stringify(datos) }); }
async function apiEliminarChatbotFaq(id)       { return apiFetch('/chatbot-faq/' + id, { method: 'DELETE' }); }

/* ================================================================
   CONFIGURACIÓN DEL SITIO
================================================================ */

async function apiGetContacto()          { return apiFetch('/config/contacto'); }
async function apiGuardarContacto(datos) { return apiFetch('/config/contacto', { method: 'PUT', body: JSON.stringify(datos) }); }

/* Envía el formulario de la página Contacto — reemplaza al POST directo
   a Formspree que se usaba antes (ver contacto.js). Público, no
   necesita sesión. */
async function apiEnviarContacto(datos) {
  return apiFetch('/config/contacto-mensaje', { method: 'POST', body: JSON.stringify(datos) });
}

/* ================================================================
   AVISOS DE STOCK (panel admin)
   Ver backend/routes/avisos.js.
================================================================ */
async function apiGetAvisosStock() { return apiFetch('/avisos-stock'); }

/* ================================================================
   AUDITORÍAS (panel admin)
   Ver backend/routes/auditorias.js. apiGetAuditoriaHtml() NO usa
   apiFetch porque la respuesta es HTML crudo, no JSON — se maneja
   con fetch() directo, pero igual mandando el token de admin.
================================================================ */
async function apiGetAuditorias() { return apiFetch('/auditorias'); }

async function apiGetAuditoriaHtml(nombre) {
  const token = getToken();
  const res = await fetch(API_BASE + '/auditorias/' + encodeURIComponent(nombre), {
    headers: token ? { 'Authorization': 'Bearer ' + token } : {}
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al obtener la auditoría.');
  }
  return res.text();
}

/* ================================================================
   RESPALDOS (panel admin)
   Ver backend/routes/respaldos.js.
================================================================ */
async function apiGetRespaldoInfo() { return apiFetch('/respaldos'); }
async function apiGenerarRespaldo() { return apiFetch('/respaldos', { method: 'POST' }); }

/* ================================================================
   FUNCIÓN INTERNA: _saveSession
   Guarda los datos del usuario (nombre, email, rol) en el storage
   para que auth.js pueda saber si hay sesión activa sin tener que
   hacer una petición al servidor en cada página.
   El prefijo _ indica que es de uso interno de este archivo.
================================================================ */
function _saveSession(user) {
  sessionStorage.setItem('dc_session', JSON.stringify(user));
  localStorage.removeItem('dc_session'); // por si tenía una sesión persistente de antes de este cambio
}
