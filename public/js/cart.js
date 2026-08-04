/* ================================================================
   ARCHIVO: js/cart.js
   PROPÓSITO: Utilidades compartidas que se usan en TODAS las páginas.
   Es el archivo más "global" del frontend. Maneja:
   - El carrito de compras
   - Los productos favoritos
   - El modal de detalle de producto
   - El menú drawer (cajón lateral)
   - El modo oscuro
   - Las tarjetas de producto
   - Las notificaciones (toast)
   - El efecto de aparición al hacer scroll (reveal)
   - Los badges de contador (carrito y pedidos inconclusos)

   ¿POR QUÉ TODO EN UN SOLO ARCHIVO?
   Porque todas estas funciones se necesitan en TODAS las páginas.
   En lugar de duplicar el código en cada HTML, se carga cart.js
   una sola vez y queda disponible globalmente.

   ESTRATEGIA DE ALMACENAMIENTO DEL CARRITO:
   ┌────────────────┬────────────────────────────┬────────────────────┐
   │ Tipo usuario   │ Dónde se guarda            │ Cuándo se borra    │
   ├────────────────┼────────────────────────────┼────────────────────┤
   │ Visitante      │ sessionStorage             │ Al cerrar pestaña  │
   │ Registrado     │ localStorage, por usuario  │ Solo al vaciarlo   │
   │                │ (clave dc_cart_<id>)       │ a mano             │
   └────────────────┴────────────────────────────┴────────────────────┘
   El carrito de cada cuenta se guarda en su PROPIA clave (dc_cart_<id
   del usuario>), no en una sola clave compartida. Por eso: (1) el
   carrito de un cliente registrado sigue ahí aunque cierre sesión y
   vuelva a entrar después, y (2) si otra persona inicia sesión en la
   misma computadora, nunca ve el carrito de la cuenta anterior — cada
   quien tiene el suyo, aislado por id de usuario.
================================================================ */

/* ================================================================
   SECCIÓN: ESCAPE DE HTML (seguridad)
   Convierte texto a HTML seguro escapando los caracteres que
   podrían romper el marcado o inyectar <script>/onerror/etc.
   Se usa en TODOS los lugares donde se inserta texto que viene de
   datos (nombre de cliente, de producto, de pedido...) dentro de
   innerHTML. Sin esto, alguien podría registrarse con un nombre como
   "<img src=x onerror=...>" y ejecutar JS en el navegador de quien
   vea ese nombre (ej: el admin viendo la lista de pedidos/usuarios).
================================================================ */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ================================================================
   SECCIÓN: TOTAL DE UN PEDIDO (con respaldo desde items)
   Si el campo total de un pedido viene en 0 (datos viejos o algún
   caso límite), lo recalculamos sumando sus items. Esta lógica
   estaba duplicada casi línea por línea en pedidos.js, comprobante.js
   y admin.js — ahora vive en un solo lugar.
   pedido: objeto con { total, items: [{precio/price, cantidad/qty}] }
================================================================ */
function calcTotalPedido(pedido) {
  var t = parseFloat(pedido.total || 0);
  if (!t && pedido.items && pedido.items.length) {
    t = pedido.items.reduce(function (s, i) {
      return s + parseFloat(i.precio || i.price || 0) * (i.cantidad || i.qty || 1);
    }, 0);
  }
  return t;
}

/* ================================================================
   SECCIÓN: CARRITO DE COMPRAS
================================================================ */

/* Clave de localStorage del carrito del usuario logueado — una por
   cuenta, para que el carrito persista al cerrar sesión SIN mezclarse
   con el de otra cuenta que inicie sesión después en la misma compu. */
function _cartKey() {
  var u = getCurrentUser(); // auth.js
  return u ? ('dc_cart_' + u.id) : null;
}

/* Lee el carrito guardado en el storage del navegador.
   Usa JSON.parse porque el storage solo guarda texto, no objetos.
   Si no hay carrito, devuelve un array vacío [] en lugar de null. */
function getCart() {
  if (isLoggedIn()) {
    return JSON.parse(localStorage.getItem(_cartKey()) || '[]');
    // isLoggedIn() está en auth.js, devuelve true si hay sesión activa
  }
  return JSON.parse(sessionStorage.getItem('dc_cart') || '[]');
}

/* Guarda el carrito actualizado en el storage.
   JSON.stringify convierte el array de objetos a texto para poder guardarlo.
   Después de guardar, actualiza el número del badge en la navbar. */
function saveCart(c) {
  if (isLoggedIn()) {
    localStorage.setItem(_cartKey(), JSON.stringify(c));
    sessionStorage.removeItem('dc_cart'); // limpiamos el otro storage por si quedó algo
  } else {
    sessionStorage.setItem('dc_cart', JSON.stringify(c));
  }
  updateCartBadge(); // actualiza el número rojo del carrito en el menú
}

/* MIGRACIÓN DEL CARRITO AL INICIAR SESIÓN.
   Problema: el visitante agrega 3 productos sin estar logueado.
   Luego inicia sesión. ¿Qué pasa con esos 3 productos?
   Esta función los "fusiona" con el carrito del usuario registrado.
   Si un producto ya está en ambos carritos, suma las cantidades.
   Si solo estaba en el carrito del visitante, lo agrega al del usuario. */
function migrateCartOnLogin() {
  var visitorCart = JSON.parse(sessionStorage.getItem('dc_cart') || '[]');
  if (visitorCart.length) {
    var key      = _cartKey(); // ya hay sesión activa cuando se llama esta función
    var userCart = JSON.parse(localStorage.getItem(key) || '[]');

    visitorCart.forEach(function(item) {
      var existing = userCart.find(function(i) { return i.id === item.id; });
      if (existing) {
        existing.qty += item.qty; // el producto ya estaba → sumamos cantidades
      } else {
        userCart.push(item); // producto nuevo → lo agregamos
      }
    });

    localStorage.setItem(key, JSON.stringify(userCart));
    sessionStorage.removeItem('dc_cart'); // limpiamos el carrito del visitante
  }
}


/* ================================================================
   SECCIÓN: FAVORITOS
   Los favoritos funcionan diferente según si hay sesión o no:
   - Visitante:   se guardan como lista de IDs en sessionStorage
   - Registrado:  se guardan en la BD (MySQL) a través de la API,
                  con un caché local para no hacer peticiones en cada render
================================================================ */

/* Caché en memoria de los IDs de favoritos del usuario logueado.
   null = aún no se han cargado desde la API
   [] = se cargaron pero no hay ninguno
   [1, 5, 23] = IDs de los productos favoritos */
var DC_FAV_CACHE = null;

/* Carga los favoritos del usuario desde la API y los guarda en el caché.
   Se llama una vez al cargar cada página (si hay sesión activa).
   Esto evita hacer una petición al servidor cada vez que queremos
   saber si un producto es favorito. */
async function loadFavorites() {
  if (!isLoggedIn()) { DC_FAV_CACHE = null; return; }
  try {
    var prods = await apiGetFavoritos(); // petición al servidor
    DC_FAV_CACHE = prods.map(function(p) { return p.id; });
    // Solo guardamos los IDs en el caché, no todos los datos del producto
    // Esto hace que isFavorite() sea rápido (búsqueda en array local)
  } catch(e) {
    DC_FAV_CACHE = []; // si falla la API, asumimos que no hay favoritos
  }
}

/* Devuelve la lista actual de IDs favoritos (síncrona, usa caché o sessionStorage).
   Es síncrona para poder usarse dentro de buildProductCard sin complicar el código. */
function getFavorites() {
  if (isLoggedIn()) return DC_FAV_CACHE || [];
  return JSON.parse(sessionStorage.getItem('dc_favorites') || '[]');
}

/* Verifica si un producto específico está en favoritos.
   Devuelve true o false. Se usa para mostrar el corazón relleno o vacío. */
function isFavorite(id) { return getFavorites().indexOf(id) !== -1; }

/* Agrega o quita un producto de favoritos (toggle = alternancia).
   Si ya era favorito → lo quita. Si no era → lo agrega.
   Para usuarios registrados: actualiza el caché LOCAL inmediatamente
   (para que la UI responda rápido) y luego llama a la API en segundo plano.
   Devuelve una Promise<boolean>: true si quedó como AGREGADO, false si
   quedó como QUITADO (o si canceló el diálogo, sigue siendo favorito
   → también true). Es async porque el diálogo de confirmación (más
   abajo, dcConfirm) es una ventana propia del sitio, no el confirm()
   nativo del navegador — hay que esperar a que la persona le dé clic
   a un botón. */
async function toggleFavorite(id) {
  var favs  = getFavorites();
  var idx   = favs.indexOf(id);
  var added = idx === -1; // si no estaba en la lista → se va a agregar

  // Quitar un favorito pide confirmación primero (fácil darle sin querer
  // al corazón); agregar uno no la necesita, es una acción reversible
  // de un clic. Si cancela, no se toca nada y sigue siendo favorito.
  if (!added && !(await dcConfirm('¿Quitar este producto de tus favoritos?', 'Quitar'))) {
    return true;
  }

  if (isLoggedIn()) {
    if (added) {
      favs.push(id);
      DC_FAV_CACHE = favs;
      // Antes esto no se esperaba (fire-and-forget): en favoritos.html el
      // evento dc:favtoggle (más abajo) dispara un re-render que vuelve a
      // pedir la lista a la API, y si esa petición ganaba la carrera contra
      // este POST/DELETE, el re-render mostraba el estado VIEJO del server
      // (el producto "quitado" seguía apareciendo hasta un segundo clic).
      // Al esperar aquí, cuando se dispara el evento la BD ya quedó al día.
      try { await apiAgregarFavorito(id); } catch (e) { console.warn(e); }
    } else {
      favs.splice(idx, 1); // splice(posición, cuántos eliminar) → borra 1 elemento
      DC_FAV_CACHE = favs;
      try { await apiQuitarFavorito(id); } catch (e) { console.warn(e); }
    }
  } else {
    // Visitante: solo guardamos en sessionStorage (sin API)
    if (added) favs.push(id); else favs.splice(idx, 1);
    sessionStorage.setItem('dc_favorites', JSON.stringify(favs));
  }

  if (!added) showToast('Producto quitado de favoritos', '❤️');

  // Aviso para quien necesite reaccionar al cambio real (ej: favoritos.js
  // recargando su lista) en vez de adivinar con un setTimeout si ya
  // terminó — antes eso asumía que el confirm() nativo (síncrono) ya
  // había bloqueado hasta que la persona respondiera; con el diálogo
  // propio (async) esa suposición ya no aplica.
  document.dispatchEvent(new CustomEvent('dc:favtoggle', { detail: { id: id, added: added } }));

  return added;
}

/* MIGRACIÓN DE FAVORITOS AL INICIAR SESIÓN.
   Igual que migrateCartOnLogin pero para favoritos.
   Envía cada ID favorito del visitante a la API para guardarlo en la BD. */
async function migrateFavoritesOnLogin() {
  var visitorFavs = JSON.parse(sessionStorage.getItem('dc_favorites') || '[]');
  if (visitorFavs.length) {
    for (var i = 0; i < visitorFavs.length; i++) {
      try { await apiAgregarFavorito(visitorFavs[i]); } catch(e) {}
      // El try/catch vacío ignora errores (ej: si el favorito ya existía en la BD)
    }
    sessionStorage.removeItem('dc_favorites');
  }
  await loadFavorites(); // recargamos el caché con los favoritos actualizados
}

/* ================================================================
   SECCIÓN: OPERACIONES DEL CARRITO
================================================================ */

/* Agrega un producto al carrito.
   Si el producto ya está en el carrito → aumenta su cantidad en 1.
   Si no estaba → lo agrega como nuevo con qty:1.
   Al terminar muestra una notificación (toast) y anima el badge. */
function addToCart(productId) {
  var product  = getAllProducts().find(function(p) { return p.id === productId; });
  // getAllProducts() devuelve los productos cargados (del caché o del array estático)
  if (!product) return; // si el producto no existe, no hacemos nada

  // Si el producto trae info de stock y ya no queda, no lo dejamos agregar
  // (el botón ya debería estar deshabilitado, esto es un respaldo extra).
  if (product.stock !== undefined && product.stock <= 0) {
    showToast(product.name + ' está agotado');
    return;
  }

  var cart     = getCart();
  var existing = cart.find(function(i) { return i.id === productId; });

  if (existing) {
    existing.qty += 1; // ya estaba → sumamos 1
  } else {
    // No estaba → lo agregamos con sus datos básicos
    // Solo guardamos lo necesario para el carrito (no toda la info del producto)
    cart.push({
      id:       product.id,
      name:     product.name,
      category: product.category,
      price:    product.price,
      image:    product.image,
      qty:      1
    });
  }

  saveCart(cart);
  showToast(product.name + ' agregado'); // notificación flotante
  bounceCartBadge();                     // animación en el número del carrito
}

/* Actualiza el número del badge del carrito en todos los lugares donde aparece.
   Usa querySelectorAll para actualizarlos TODOS a la vez (navbar y drawer).
   .reduce() suma todas las cantidades de todos los productos del carrito. */
function updateCartBadge() {
  var total = getCart().reduce(function(s, i) { return s + i.qty; }, 0);
  // reduce(función, valorInicial) → recorre el array acumulando un resultado
  // s = suma acumulada, i = item actual → suma todas las cantidades
  document.querySelectorAll('#cart-count').forEach(function(el) {
    el.textContent   = total;
    el.style.display = total > 0 ? 'inline' : 'none'; // ocultar si es 0
  });
}

/* Anima el badge del carrito con un "rebote" al agregar un producto.
   void el.offsetWidth fuerza al navegador a recalcular el layout,
   esto es necesario para reiniciar la animación CSS correctamente. */
function bounceCartBadge() {
  document.querySelectorAll('#cart-count').forEach(function(el) {
    el.classList.remove('cart-badge-bounce');
    void el.offsetWidth; // truco para reiniciar la animación CSS
    el.classList.add('cart-badge-bounce');
    setTimeout(function() { el.classList.remove('cart-badge-bounce'); }, 450);
  });
}

/* ================================================================
   SECCIÓN: BADGE DE PEDIDOS INCONCLUSOS
   Muestra un contador en "Mis Pedidos" igual que el del carrito,
   pero indicando cuántos pedidos quedaron sin completar.
   Solo aparece si el usuario está logueado y tiene inconclusos.
================================================================ */
async function updatePedidosBadge() {
  var spans = document.querySelectorAll('#pedidos-count');
  if (!spans.length) return; // si la página no tiene el badge, no hacemos nada

  if (!isLoggedIn()) {
    spans.forEach(function (s) { s.style.display = 'none'; });
    return; // visitantes no tienen pedidos
  }

  try {
    var pedidos = await apiGetMisPedidos();
    var count   = pedidos.filter(function (p) { return p.estado === 'pendiente_finalizar'; }).length;
    // .filter() devuelve solo los pedidos con estado 'inconcluso'
    // .length cuenta cuántos son

    spans.forEach(function (s) {
      s.textContent   = count;
      s.style.display = count > 0 ? 'inline' : 'none';
    });
  } catch (e) {
    spans.forEach(function (s) { s.style.display = 'none'; });
  }
}

/* ================================================================
   SECCIÓN: NOTIFICACIÓN TOAST
   El "toast" es el pequeño mensaje que aparece en la esquina
   inferior izquierda cuando agregas algo al carrito.
   Se llama "toast" porque aparece y desaparece como una tostadora.
   icon es opcional (por defecto 🛒); ej: showToast('...', '❤️') para
   avisos de favoritos en vez del carrito.
================================================================ */
function showToast(msg, icon) {
  var toast = document.getElementById('dc-toast');

  // Si el elemento no existe aún, lo creamos dinámicamente
  if (!toast) {
    toast    = document.createElement('div');
    toast.id = 'dc-toast';
    // Object.assign copia múltiples propiedades de estilo de una sola vez
    Object.assign(toast.style, {
      position:'fixed', bottom:'28px', left:'24px',
      transform:'translateX(-120%)',   // empieza fuera de pantalla (a la izquierda)
      background:'rgba(30,20,40,0.55)',
      backdropFilter:'blur(12px)',     // efecto de vidrio esmerilado
      color:'#fff',
      padding:'0.75rem 1.4rem', borderRadius:'14px',
      fontFamily:'Nunito,sans-serif', fontWeight:'700', fontSize:'0.92rem',
      zIndex:'999',
      transition:'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease',
      // cubic-bezier define la curva de aceleración de la animación (suave)
      opacity:'0', maxWidth:'280px',
    });
    document.body.appendChild(toast);
  }

  toast.textContent     = (icon || '🛒') + ' ' + msg;
  toast.style.transform = 'translateX(0)';  // desliza hacia adentro
  toast.style.opacity   = '1';

  clearTimeout(toast._t); // cancela el temporizador anterior si había uno activo
  // Esto evita que varios toasts se encimen si agregas productos rápido

  toast._t = setTimeout(function() {
    toast.style.transform = 'translateX(-120%)'; // desliza hacia afuera
    toast.style.opacity   = '0';
  }, 2500); // desaparece después de 2.5 segundos
}

/* ================================================================
   SECCIÓN: DIÁLOGO DE CONFIRMACIÓN PROPIO
   Reemplaza al confirm() nativo del navegador (el recuadro feo que
   dice "localhost:3000 dice...") por una ventana con el estilo del
   sitio. Se inyecta una sola vez, igual que el modal de producto.
   Uso: var ok = await dcConfirm('¿Seguro?', 'Quitar');
================================================================ */
function _injectConfirmDialog() {
  if (document.getElementById('dc-confirm-overlay')) return;

  var overlay = document.createElement('div');
  overlay.id        = 'dc-confirm-overlay';
  overlay.className = 'dc-confirm-overlay';
  overlay.innerHTML =
    '<div class="dc-confirm-box">' +
      '<p class="dc-confirm-msg" id="dc-confirm-msg"></p>' +
      '<div class="dc-confirm-actions">' +
        '<button class="btn btn-outline" id="dc-confirm-cancel">Cancelar</button>' +
        '<button class="btn btn-primary" id="dc-confirm-ok">Confirmar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
}

function dcConfirm(msg, okLabel) {
  _injectConfirmDialog();
  return new Promise(function (resolve) {
    var overlay = document.getElementById('dc-confirm-overlay');
    var msgEl   = document.getElementById('dc-confirm-msg');
    var okBtn   = document.getElementById('dc-confirm-ok');
    var noBtn   = document.getElementById('dc-confirm-cancel');

    msgEl.textContent = msg;
    okBtn.textContent = okLabel || 'Confirmar';

    function finish(result) {
      overlay.classList.remove('open');
      okBtn.removeEventListener('click', onOk);
      noBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }
    function onOk()       { finish(true); }
    function onCancel()   { finish(false); }
    function onOverlayClick(e) { if (e.target === overlay) finish(false); }
    function onKeydown(e) { if (e.key === 'Escape') finish(false); }

    okBtn.addEventListener('click', onOk);
    noBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeydown);
    overlay.classList.add('open');
  });
}

/* ================================================================
   SECCIÓN: MODO OSCURO
   Guarda la preferencia del tema en localStorage para que
   persista entre páginas y sesiones.
================================================================ */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // data-theme en el <html> activa las variables CSS del modo oscuro
  // definidas en style.css con [data-theme="dark"] { --bg: #1a1a2e; ... }

  localStorage.setItem('dc_theme', theme); // recordar la preferencia

  var btn = document.getElementById('dark-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro';
  // Cambiamos el texto del botón según el tema actual
}

/* ================================================================
   SECCIÓN: MODAL DE PRODUCTO
   Al hacer clic en la imagen de un producto, se abre un modal
   (ventana emergente) con más detalle: descripción, precio,
   botón de carrito y de favorito.
================================================================ */

/* Descripciones fijas por categoría para el modal de producto */
var PROD_DESCS = {
  bombones:   'Deliciosos bombones elaborados con los mejores ingredientes. Perfectos para compartir o darse un capricho dulce.',
  botanas:    'Botana irresistible con el sabor que tanto te gusta. Ideal para botanear solo o en compania.',
  chocolates: 'Chocolate de alta calidad con un sabor intenso y cremoso que te va a encantar a cada mordida.',
  enchilados: 'El toque picante que buscabas. Dulce con chile para los amantes de las emociones fuertes.',
  gomitas:    'Gomitas suaves y jugosas con sabores frutales que te llenan de alegria y frescura.',
  mazapanes:  'Mazapan tradicional hecho con cacahuate seleccionado. Un clasico mexicano que nunca falla.',
  paletas:    'Paleta artesanal de sabores unicos. Refrescante y deliciosa en cada lamida.'
};

/* Crea el HTML del modal e inserta en el <body>.
   Solo se llama una vez (verifica si ya existe antes de crearlo).
   Usa innerHTML para construir el HTML del modal como string. */
function injectProductModal() {
  if (document.getElementById('prod-modal-overlay')) return;
  // Si el modal ya existe, no lo creamos de nuevo

  var overlay       = document.createElement('div');
  overlay.id        = 'prod-modal-overlay';
  overlay.className = 'prod-modal-overlay';
  overlay.innerHTML =
    '<div class="prod-modal" role="dialog" aria-modal="true">' +
      '<button class="prod-modal-close" id="prod-modal-close" aria-label="Cerrar">&#x2715;</button>' +
      '<div class="prod-modal-img-wrap">' +
        '<img class="prod-modal-img" id="prod-modal-img" src="" alt="">' +
      '</div>' +
      '<div class="prod-modal-body">' +
        '<p class="prod-modal-cat"  id="prod-modal-cat"></p>' +
        '<h2 class="prod-modal-name" id="prod-modal-name"></h2>' +
        '<p class="prod-modal-desc" id="prod-modal-desc"></p>' +
        '<p class="prod-modal-price" id="prod-modal-price"></p>' +
        '<p class="prod-modal-stock-note hidden" id="prod-modal-stock-note"></p>' +
        '<div class="prod-modal-actions">' +
          '<button class="btn btn-primary" id="prod-modal-add">&#128722; Agregar al carrito</button>' +
          '<button class="prod-modal-fav" id="prod-modal-fav">&#9825;</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  // Cerrar al hacer clic en el fondo oscuro (fuera del modal)
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeProductModal();
    // e.target === overlay significa que se hizo clic EN EL FONDO,
    // no en el contenido del modal (que sería un hijo del overlay)
  });
  document.getElementById('prod-modal-close').addEventListener('click', closeProductModal);
}

var _modalProductId = null; // guarda el ID del producto que está abierto en el modal

/* Abre el modal con los datos de un producto específico.
   Rellena todos los campos (imagen, nombre, categoría, precio, favorito). */
function openProductModal(productId) {
  var product = getAllProducts().find(function(p) { return p.id === productId; });
  if (!product) return;
  _modalProductId = productId;

  var img     = document.getElementById('prod-modal-img');
  img.src     = product.image || '';
  img.alt     = product.name;
  img.onerror = function() { img.style.display = 'none'; }; // ocultar si la imagen falla
  img.style.display = '';

  document.getElementById('prod-modal-cat').textContent   = product.category;
  document.getElementById('prod-modal-name').textContent  = product.name;
  document.getElementById('prod-modal-desc').textContent  = PROD_DESCS[product.category] || 'Producto de calidad de Dulceria Charles.';
  document.getElementById('prod-modal-price').textContent = '$' + product.price;

  /* Estado de stock: agotado deshabilita el botón, bajo muestra un aviso */
  var outOfStock = product.stock !== undefined && product.stock <= 0;
  var lowStock    = !outOfStock && product.stock !== undefined && product.stock_minimo !== undefined && product.stock <= product.stock_minimo;
  var addBtn = document.getElementById('prod-modal-add');
  addBtn.disabled = outOfStock;
  addBtn.innerHTML = outOfStock ? 'Agotado' : '&#128722; Agregar al carrito';

  var stockNote = document.getElementById('prod-modal-stock-note');
  if (lowStock) {
    stockNote.textContent = '¡Últimas ' + product.stock + ' piezas!';
    stockNote.classList.remove('hidden');
  } else {
    stockNote.classList.add('hidden');
  }

  var favBtn = document.getElementById('prod-modal-fav');
  _updateModalFavBtn(favBtn, isFavorite(productId));

  // Al hacer clic en el corazón: alternar favorito y actualizar el botón
  favBtn.onclick = async function() {
    var nowFav = await toggleFavorite(productId);
    _updateModalFavBtn(favBtn, nowFav);
    // También actualizamos el corazón en la tarjeta del catálogo (si está visible)
    var cardHeart = document.querySelector('.card-fav[data-id="' + productId + '"]');
    if (cardHeart) {
      cardHeart.innerHTML = nowFav ? '&#10084;&#65039;' : '&#9825;';
      cardHeart.classList.toggle('active', nowFav);
    }
  };

  document.getElementById('prod-modal-add').onclick = function() {
    addToCart(productId);
    closeProductModal(); // cerramos el modal después de agregar
  };

  document.getElementById('prod-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden'; // evitamos scroll del fondo mientras el modal está abierto
}

/* Actualiza el ícono y texto del botón de favorito en el modal */
function _updateModalFavBtn(btn, isFav) {
  btn.innerHTML = isFav ? '&#10084;&#65039;' : '&#9825;'; // corazón relleno o vacío
  btn.classList.toggle('active', isFav);
  btn.title = isFav ? 'Quitar de favoritos' : 'Agregar a favoritos';
}

/* Cierra el modal y restaura el scroll de la página */
function closeProductModal() {
  var overlay = document.getElementById('prod-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = ''; // restaurar scroll
  _modalProductId = null;
}

/* ================================================================
   SECCIÓN: CONFIG DE CONTACTO EN CACHÉ
   apiGetContacto() la necesitan tanto initFooterContacto() como el
   chatbot del sitio (ver más abajo). En vez de pedirla dos veces al
   servidor en cada página, se pide una sola vez por carga de página
   y se comparte la misma promesa entre ambos.
================================================================ */
var _contactoCfgPromise = null;
function getContactoCfg() {
  if (!_contactoCfgPromise) {
    _contactoCfgPromise = (typeof apiGetContacto === 'function')
      ? apiGetContacto().catch(function (e) {
          console.warn('No se pudo cargar la info de contacto:', e.message);
          return {}; // valores por defecto: el resto del código ya sabe mostrar "—"/placeholders
        })
      : Promise.resolve({});
  }
  return _contactoCfgPromise;
}

/* Link de WhatsApp a partir de la config de contacto.
   Si el campo "WhatsApp" de Configuración no se llenó a propósito
   (sigue en "#", el valor por defecto), se arma automáticamente con
   el teléfono de contacto — en la mayoría de los negocios chicos es
   el mismo número — para que el botón/ícono no se quede muerto solo
   por no haber llenado ese campo aparte. Si de plano no hay ni
   teléfono ni WhatsApp configurado, devuelve null. */
function getWaLink(cfg) {
  if (cfg.contacto_whatsapp && cfg.contacto_whatsapp !== '#') return cfg.contacto_whatsapp;
  var digits = (cfg.contacto_telefono || '').replace(/\D/g, '');
  return digits.length >= 10 ? 'https://wa.me/' + digits : null;
}

/* Link "tel:" para el teléfono de contacto. Abre el marcador nativo del
   dispositivo con el número ya cargado — el cliente sigue siendo quien
   decide si presiona "Llamar", esto solo evita que tenga que copiar/marcar
   el número a mano. Se usa en todos los lugares donde el número aparece
   al público (footer, página de Contacto, pickup del checkout, comprobante). */
function telHref(phone) {
  return phone ? 'tel:' + phone.replace(/[^\d+]/g, '') : null;
}

/* ================================================================
   SECCIÓN: FOOTER DE CONTACTO (dirección/horario/teléfono/email)
   Antes esta info estaba escrita a mano en el footer de cada página
   (texto fijo), así que cuando el admin la cambiaba en Configuración
   el footer se quedaba desactualizado — solo pago.html la cargaba
   dinámicamente, y con su propia copia de este mismo código.
   Ahora una sola función llena el footer en TODAS las páginas que
   tengan estos elementos (se busca por id; si una página no los
   tiene, no hace nada) y de paso los deja como links de verdad
   (dirección → Google Maps, teléfono → tel:, correo → mailto:).
================================================================ */
async function initFooterContacto() {
  var dirEl  = document.getElementById('footer-direccion');
  var horEl  = document.getElementById('footer-horario');
  var telEl  = document.getElementById('footer-telefono');
  var mailEl = document.getElementById('footer-email');
  var waEl   = document.getElementById('footer-whatsapp');
  if (!dirEl && !horEl && !telEl && !mailEl && !waEl) return; // esta página no tiene nada de esto

  var cfg = await getContactoCfg();
  var dir = (cfg.contacto_direccion || '') + (cfg.contacto_ciudad ? ', ' + cfg.contacto_ciudad : '');

  if (dirEl) {
    dirEl.textContent = dir || 'Ver dirección';
    dirEl.href = dir ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(dir) : '#';
  }
  if (horEl) {
    // contacto_horario guarda varias líneas separadas por "|" (ej. Lun-Vie,
    // Sábados, Domingos). Antes solo se mostraba horLineas[0] (la primera),
    // así que el footer se veía como si solo se abriera de lunes a viernes.
    // innerHTML + <br> porque necesitamos un salto de línea real dentro
    // del <span>, un textContent con \n no se ve como salto de línea.
    var horLineas = (cfg.contacto_horario || '').split('|').map(escapeHtml);
    horEl.innerHTML = horLineas.length ? horLineas.join('<br>') : '—';
  }
  if (telEl) {
    telEl.textContent = cfg.contacto_telefono || '—';
    telEl.href = telHref(cfg.contacto_telefono) || '#';
  }
  if (mailEl) {
    mailEl.textContent = cfg.contacto_email || '—';
    mailEl.href = cfg.contacto_email ? 'mailto:' + cfg.contacto_email : '#';
  }

  var waLink = getWaLink(cfg);
  if (waEl && waLink) waEl.href = waLink;
}

/* ================================================================
   SECCIÓN: BURBUJA FLOTANTE (abre el chat del sitio)
   Botón flotante fijo en la esquina inferior derecha, en todas las
   páginas (se inyecta una sola vez, igual que el modal de producto).
   Ya no es un link directo a WhatsApp: ahora abre/cierra el panel
   del chatbot del sitio (ver injectChatWidget más abajo), que a su
   vez ofrece un botón para continuar la conversación por el
   WhatsApp real cuando esté configurado.
================================================================ */
function injectWhatsAppBubble() {
  if (document.getElementById('wa-bubble')) return;

  var btn = document.createElement('button');
  btn.type      = 'button';
  btn.id        = 'wa-bubble';
  btn.className = 'wa-bubble visible';
  btn.title     = 'Chat de Dulcería Charles';
  btn.setAttribute('aria-label', 'Abrir chat');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="28" height="28">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>' +
    '</svg>';
  document.body.appendChild(btn);

  btn.addEventListener('click', toggleChatPanel);
}

/* ================================================================
   SECCIÓN: CHATBOT DEL SITIO
   Widget de chat propio (no es WhatsApp, corre solo en la página).
   Contesta preguntas frecuentes con la misma info de Configuración >
   Contacto que ya usa el footer (horario, dirección, WhatsApp...),
   por botones rápidos o texto libre con reconocimiento por palabras
   clave. Para lo que no sabe contestar — o si el cliente prefiere
   hablar con alguien — siempre ofrece un botón para seguir la
   conversación por el WhatsApp real del negocio, con el mensaje ya
   escrito según lo que preguntó. Se abre/cierra con el botón
   flotante (#wa-bubble).
================================================================ */
// Respaldo si /api/chatbot-faq falla (mismo comportamiento que tenía el
// chatbot antes de ser configurable desde el admin — ver panel Chatbot).
var CHAT_FAQ_FALLBACK = [
  { id: 'f1', pregunta: '📍 Ubicación y horario', palabras_clave: 'horario,hora,abren,cierran,direccion,ubicacion,domicilio,donde estan,donde queda',
    respuesta: '📍 {direccion}\n🕒 {horario}', accion_tipo: 'ninguna' },
  { id: 'f2', pregunta: '🛍️ ¿Cómo hago un pedido?', palabras_clave: 'como pido,como compro,hacer un pedido,como funciona,proceso de compra',
    respuesta: 'Es bien fácil: 1️⃣ elige tus productos y agrégalos al carrito 🛒, 2️⃣ ve a pagar y confirma tus datos, 3️⃣ pasas a recoger tu pedido a la tienda y pagas en efectivo al recogerlo 💵.', accion_tipo: 'ninguna' },
  { id: 'f3', pregunta: '🍬 Ver catálogo', palabras_clave: 'catalogo,productos,que venden,bombones,chocolates,gomitas,mazapanes,botanas,enchilados,paletas,refrescos,dulces',
    respuesta: 'Tenemos bombones, botanas, chocolates, enchilados, gomitas, mazapanes, paletas y refrescos 🍬.', accion_tipo: 'catalogo', accion_texto: '🍬 Ir al catálogo →' },
  { id: 'f4', pregunta: '💳 Métodos de pago', palabras_clave: 'pago,pagar,efectivo,tarjeta,transferencia,metodo de pago',
    respuesta: 'Por ahora solo manejamos pago en efectivo, directo al recoger tu pedido en tienda 💵.', accion_tipo: 'ninguna' },
  { id: 'f5', pregunta: '📦 Estado de mi pedido', palabras_clave: 'mi pedido,estado de mi pedido,donde va mi pedido,rastrear,numero de pedido',
    respuesta: 'Puedes ver el estado de todos tus pedidos desde tu cuenta.', accion_tipo: 'pedidos', accion_texto: '📦 Ver mis pedidos →' },
  { id: 'f6', pregunta: '💬 Hablar con una persona', palabras_clave: 'whatsapp,humano,persona,asesor,hablar con alguien,atencion',
    respuesta: 'Claro, te comunico con nosotros 👇 toca el botón verde de abajo para seguir por WhatsApp.', accion_tipo: 'whatsapp' }
];

var _chatLastUserText = ''; // último texto del cliente, para armar el mensaje del CTA de WhatsApp

/* Preguntas del chatbot en caché — se piden una sola vez por carga de
   página (igual que getContactoCfg) y las administra el admin desde
   el panel (sec-chatbot → backend/routes/chatbot_faq.js). */
var _chatFaqsPromise = null;
function getChatFaqs() {
  if (!_chatFaqsPromise) {
    _chatFaqsPromise = (typeof apiGetChatbotFaqs === 'function')
      ? apiGetChatbotFaqs().then(function (faqs) { return faqs && faqs.length ? faqs : CHAT_FAQ_FALLBACK; })
          .catch(function (e) {
            console.warn('No se pudieron cargar las preguntas del chatbot:', e.message);
            return CHAT_FAQ_FALLBACK;
          })
      : Promise.resolve(CHAT_FAQ_FALLBACK);
  }
  return _chatFaqsPromise;
}

/* Invalida la caché de preguntas — la usa el panel admin (sec-chatbot)
   después de guardar/borrar una pregunta, para que la vista previa del
   chatbot (botón "🧪 Probar chatbot") refleje el cambio al instante
   sin tener que recargar la página. */
function resetChatFaqsCache() { _chatFaqsPromise = null; }

function _stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Busca, entre las palabras_clave de cada pregunta (separadas por coma),
// alguna que aparezca en el texto libre que escribió el cliente.
function chatMatchKeyword(text, faqs) {
  var norm = _stripAccents(text.toLowerCase());
  for (var i = 0; i < faqs.length; i++) {
    var palabras = (faqs[i].palabras_clave || '').split(',').map(function (w) { return _stripAccents(w.trim().toLowerCase()); }).filter(Boolean);
    for (var j = 0; j < palabras.length; j++) {
      if (palabras[j] && norm.indexOf(palabras[j]) !== -1) return faqs[i];
    }
  }
  return null;
}

// Sustituye los placeholders {direccion} {horario} {telefono} {email} en la
// respuesta con los datos reales de Configuración > Contacto (ver admin).
function chatFillPlaceholders(text, cfg) {
  var dir = (cfg.contacto_direccion || '') + (cfg.contacto_ciudad ? ', ' + cfg.contacto_ciudad : '');
  var horLineas = (cfg.contacto_horario || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
  var hor = horLineas.join(' · ');
  return text
    .replace(/\{direccion\}/gi, dir || 'consulta nuestra dirección en la página de Contacto')
    .replace(/\{horario\}/gi, hor || 'consulta el horario en la página de Contacto')
    .replace(/\{telefono\}/gi, cfg.contacto_telefono || '—')
    .replace(/\{email\}/gi, cfg.contacto_email || '—');
}

function injectChatWidget() {
  if (document.getElementById('dc-chat-panel')) return;

  var panel = document.createElement('div');
  panel.id = 'dc-chat-panel';
  panel.className = 'dc-chat-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat de Dulcería Charles');
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML =
    '<div class="dc-chat-header">' +
      '<div class="dc-chat-header-info">' +
        '<span class="dc-chat-avatar">🍬</span>' +
        '<div><strong>Dulcería Charles</strong><span class="dc-chat-status">Asistente del sitio</span></div>' +
      '</div>' +
      '<button type="button" class="dc-chat-close" id="dc-chat-close" aria-label="Cerrar chat">✕</button>' +
    '</div>' +
    '<div class="dc-chat-body" id="dc-chat-body"></div>' +
    '<div class="dc-chat-quick" id="dc-chat-quick"></div>' +
    '<form class="dc-chat-input-row" id="dc-chat-form">' +
      '<input type="text" class="dc-chat-input" id="dc-chat-input" placeholder="Escribe tu pregunta…" autocomplete="off" />' +
      '<button type="submit" class="dc-chat-send" aria-label="Enviar mensaje">➤</button>' +
    '</form>' +
    '<a href="#" target="_blank" rel="noopener" class="dc-chat-wa-cta" id="dc-chat-wa-cta">💬 Continuar por WhatsApp</a>';
  document.body.appendChild(panel);

  document.getElementById('dc-chat-close').addEventListener('click', closeChatPanel);

  document.getElementById('dc-chat-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var input = document.getElementById('dc-chat-input');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    var faqs = await getChatFaqs();
    chatHandleQuestion(chatMatchKeyword(text, faqs), text);
  });

  chatRenderQuickReplies();
  chatUpdateWaCta();
}

// Las preguntas rápidas se administran en el panel admin (sec-chatbot),
// se cargan desde /api/chatbot-faq (con getChatFaqs, en caché).
function chatRenderQuickReplies() {
  var wrap = document.getElementById('dc-chat-quick');
  if (!wrap) return;
  getChatFaqs().then(function (faqs) {
    wrap.innerHTML = '';
    faqs.forEach(function (faq) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dc-quick-btn';
      btn.textContent = faq.pregunta;
      btn.addEventListener('click', function () { chatHandleQuestion(faq, faq.pregunta); });
      wrap.appendChild(btn);
    });
  });
}

function chatAddMessage(text, from) {
  var body = document.getElementById('dc-chat-body');
  if (!body) return null;
  var msg = document.createElement('div');
  msg.className = 'dc-msg ' + (from === 'user' ? 'user' : 'bot');
  msg.innerHTML = escapeHtml(text).replace(/\n/g, '<br>'); // escapado: el texto del cliente pasa por aquí también
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;
  return msg;
}

/* Solo permite http(s) o rutas relativas del propio sitio — bloquea
   javascript:/data:/vbscript: por si una cuenta admin comprometida
   guarda un link malicioso en una FAQ del chatbot (ver auditoría). */
function _chatEsUrlSegura(url) {
  return /^https?:\/\//i.test(url) || url.startsWith('/') || url.startsWith('catalogo.html') ||
         url.startsWith('pedidos.html') || url.startsWith('login.html');
}

function chatAddLinkMessage(text, href, label, openBlank) {
  var msg = chatAddMessage(text, 'bot');
  if (!msg) return;
  msg.appendChild(document.createElement('br'));
  var a = document.createElement('a');
  a.href = _chatEsUrlSegura(href) ? href : '#';
  a.className = 'dc-msg-link';
  a.textContent = label;
  if (openBlank) { a.target = '_blank'; a.rel = 'noopener'; }
  msg.appendChild(a);
}

// Punto de entrada único: lo llaman tanto los botones rápidos (faq conocida)
// como el texto libre (faq puede salir null de chatMatchKeyword, si no
// coincidió ninguna palabra clave configurada en el admin).
async function chatHandleQuestion(faq, userText) {
  chatAddMessage(userText, 'user');
  _chatLastUserText = userText;
  chatUpdateWaCta();

  if (!faq) {
    chatAddMessage('No estoy seguro de eso todavía 🤔 Toca una de las opciones de abajo, o escríbenos por WhatsApp con el botón verde.', 'bot');
    return;
  }

  var cfg    = await getContactoCfg();
  var answer = chatFillPlaceholders(faq.respuesta, cfg);

  if (faq.accion_tipo === 'catalogo') {
    var hrefCat = 'catalogo.html' + (faq.accion_valor ? '?cat=' + encodeURIComponent(faq.accion_valor) : '');
    chatAddLinkMessage(answer, hrefCat, faq.accion_texto || '🍬 Ver catálogo →');
  } else if (faq.accion_tipo === 'pedidos') {
    var hrefPed = (typeof isLoggedIn === 'function' && isLoggedIn()) ? 'pedidos.html' : 'login.html';
    chatAddLinkMessage(answer, hrefPed, faq.accion_texto || '📦 Ver mis pedidos →');
  } else if (faq.accion_tipo === 'link' && faq.accion_valor) {
    chatAddLinkMessage(answer, faq.accion_valor, faq.accion_texto || 'Ver más →', /^https?:\/\//i.test(faq.accion_valor));
  } else {
    // 'whatsapp' y 'ninguna' son solo texto — el CTA de WhatsApp ya está
    // siempre visible abajo del chat para el caso 'whatsapp'.
    chatAddMessage(answer, 'bot');
  }
}

// Mantiene el botón verde "Continuar por WhatsApp" con el link real y el
// mensaje pre-escrito según lo último que haya preguntado el cliente.
function chatUpdateWaCta() {
  var cta = document.getElementById('dc-chat-wa-cta');
  if (!cta) return;
  getContactoCfg().then(function (cfg) {
    var waLink = getWaLink(cfg);
    if (!waLink) {
      cta.classList.add('dc-chat-wa-cta--disabled');
      cta.removeAttribute('href');
      return;
    }
    // Quitamos emojis del texto del cliente antes de meterlo en el mensaje
    // de WhatsApp: si vino de un boton rapido del chat (ej. "💬 Hablar con
    // una persona"), su propia etiqueta se usa como "pregunta" y no queremos
    // que el emoji del boton aparezca ahi.
    var textoLimpio = _chatLastUserText
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    var msg = textoLimpio
      ? 'Hola, vengo del chat de la página. Mi pregunta: ' + textoLimpio
      : 'Hola, vengo del chat de la página y quisiera más información 🍬';
    var sep = waLink.indexOf('?') > -1 ? '&' : '?';
    cta.href = waLink + sep + 'text=' + encodeURIComponent(msg);
    cta.classList.remove('dc-chat-wa-cta--disabled');
  });
}

function openChatPanel() {
  var panel  = document.getElementById('dc-chat-panel');
  var bubble = document.getElementById('wa-bubble');
  if (!panel) return;
  if (!panel.dataset.greeted) {
    chatAddMessage('¡Hola! 👋 Soy el asistente de Dulcería Charles. Toca una opción de abajo o escríbeme tu pregunta.', 'bot');
    panel.dataset.greeted = '1';
  }
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  if (bubble) bubble.setAttribute('aria-expanded', 'true');
  var input = document.getElementById('dc-chat-input');
  if (input) input.focus();
}

function closeChatPanel() {
  var panel  = document.getElementById('dc-chat-panel');
  var bubble = document.getElementById('wa-bubble');
  if (!panel) return;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  if (bubble) bubble.setAttribute('aria-expanded', 'false');
}

function toggleChatPanel() {
  var panel = document.getElementById('dc-chat-panel');
  if (!panel) return;
  panel.classList.contains('open') ? closeChatPanel() : openChatPanel();
}

/* ================================================================
   SECCIÓN: SCROLL REVEAL
   Efecto de aparición suave de elementos al hacer scroll.
   Los elementos con la clase "reveal" en el HTML están inicialmente
   invisibles. Cuando el usuario hace scroll y los ve, se animan.
   Usa IntersectionObserver: una API moderna del navegador que
   notifica cuando un elemento entra en el viewport (pantalla visible).
================================================================ */
function initReveal() {
  var els = document.querySelectorAll('.reveal');
  if (!els.length || !('IntersectionObserver' in window)) {
    // Si no hay elementos .reveal O el navegador es muy viejo → mostrar todo de golpe
    document.querySelectorAll('.reveal').forEach(function(el) { el.classList.add('revealed'); });
    return;
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        // El elemento entró en la pantalla → activamos la animación
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target); // dejamos de observarlo (ya se mostró)
      }
    });
  }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
  // threshold: 0 = basta con que aparezca 1px del elemento para activar la animación.
  // Antes era 0.1 (10% del ALTO del elemento), pero eso depende de qué tan alto
  // sea el elemento: la sección de "Productos destacados" en pantallas angostas
  // (360x760/800) cae a una sola columna y con muchos productos su alto supera
  // los 8000px, así que el 10% (>800px) nunca llegaba a estar visible a la vez
  // en un viewport de esa altura → la sección se quedaba con opacity:0 para
  // siempre (espacio en blanco). Con threshold 0 no depende del alto del target.
  // rootMargin negativo evita que se dispare unos pixeles antes de tiempo.

  els.forEach(function(el) { observer.observe(el); }); // observamos cada elemento
}

/* ================================================================
   SECCIÓN: ALTO REAL DEL NAVBAR
   admin.css y auth.css necesitan saber cuánto mide el navbar para
   calcular el alto del resto de la página (sidebar del admin, alto
   mínimo del login/registro, etc.). Antes tenían el valor fijo en
   68px escrito a mano; con el navbar de escritorio más cargado ahora
   (Categorías, Mis Pedidos, ícono de Cuenta) mide más que eso, y ese
   valor fijo se quedó desactualizado — se notaba como que el sidebar
   del admin no calzaba bien hasta achicar/agrandar la ventana.
   En vez de otro número fijo, OBSERVAMOS el navbar de verdad con
   ResizeObserver y guardamos su alto en --navbar-h, que esas hojas de
   estilo ya usan (con 68px solo de respaldo por si este script no
   llegó a correr). Usar ResizeObserver en vez de medir una sola vez
   en DOMContentLoaded es a propósito: el alto del navbar cambia por
   varios motivos que no son solo "cambió el tamaño de la ventana"
   (cargan las fuentes web, initNavAccountMenu cambia el botón de
   Cuenta de ícono a "Hola, nombre"...) — medir en un solo momento fijo
   siempre se quedaba corto contra alguno de esos cambios. ResizeObserver
   se dispara automáticamente cada vez que el navbar cambia de tamaño
   por CUALQUIER motivo, así que no hay que adivinar el momento correcto.*/
function watchNavbarHeight() {
  var nav = document.querySelector('.navbar');
  if (!nav) return;

  function set() { document.documentElement.style.setProperty('--navbar-h', nav.offsetHeight + 'px'); }
  set();

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(set).observe(nav);
  } else {
    // Respaldo para navegadores muy viejos sin ResizeObserver
    window.addEventListener('resize', set);
  }
}

/* ================================================================
   SECCIÓN: DESPLEGABLES DEL NAVBAR (Categorías / Cuenta)
   Los dos desplegables del navbar de escritorio (#nav-cats-dropdown,
   #nav-account-dropdown) comparten el mismo comportamiento de abrir/
   cerrar: clic en su botón lo abre (y cierra el otro, si estaba
   abierto), clic afuera o Escape lo cierra. El contenido de cada uno
   lo llenan initNavCategoriesMenu()/initNavAccountMenu() (auth.js).
================================================================ */
function closeNavDropdowns() {
  document.querySelectorAll('.nav-dropdown.open').forEach(function (d) {
    d.classList.remove('open');
    var btn = d.querySelector('.nav-dropdown-btn, .nav-icon-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}

function initNavDropdowns() {
  var dropdowns = document.querySelectorAll('.nav-dropdown');
  if (!dropdowns.length) return;

  dropdowns.forEach(function (dropdown) {
    var btn = dropdown.querySelector('.nav-dropdown-btn, .nav-icon-btn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !dropdown.classList.contains('open');
      closeNavDropdowns(); // solo un desplegable abierto a la vez
      if (willOpen) {
        dropdown.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', closeNavDropdowns); // clic fuera de cualquiera de los dos
}

/* ================================================================
   SECCIÓN: INICIALIZACIÓN AL CARGAR LA PÁGINA
   Este bloque se ejecuta cuando el HTML termina de cargarse.
   Inicializa todos los comportamientos globales.
================================================================ */
document.addEventListener('DOMContentLoaded', function() {

  /* 0. Mantener --navbar-h sincronizado con el alto real del navbar
     (ver watchNavbarHeight arriba). */
  watchNavbarHeight();

  /* 1. Aplicar el tema guardado (oscuro o claro) */
  var savedTheme = localStorage.getItem('dc_theme') || 'light';
  applyTheme(savedTheme);

  var darkBtn = document.getElementById('dark-toggle');
  if (darkBtn) {
    darkBtn.addEventListener('click', function() {
      var cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark'); // alternar entre temas
    });
  }

  /* 2. Actualizar badges de carrito y pedidos */
  updateCartBadge();
  updatePedidosBadge(); // asíncrono: consulta la API si hay sesión

  /* 3. Inyectar el modal de producto (una sola vez para toda la página) */
  injectProductModal();

  /* 4. Iniciar el efecto de scroll reveal */
  initReveal();

  /* 4b. Inyectar la burbuja flotante + el panel del chatbot del sitio
     (no en el panel de admin: es para clientes, no para quien administra
     la tienda, y ahí estorbaría sobre los formularios/tablas), y llenar
     el footer de contacto (dirección/horario/tel/email/whatsapp).
     Ver initFooterContacto() y la sección CHATBOT DEL SITIO más arriba. */
  if (!/\/admin\.html$/.test(window.location.pathname)) {
    injectWhatsAppBubble();
    injectChatWidget();
  }
  initFooterContacto();

  /* 5. Inicializar el drawer de autenticación (definido en auth.js) */
  initAuthDrawer();

  /* 5b. Cargar la sección "Categorías" del drawer (definida en auth.js) */
  if (typeof initDrawerCategories === 'function') initDrawerCategories();

  /* 5c. Desplegables del navbar de escritorio: "Categorías" y "Cuenta"
     (definidas en auth.js; en móvil van ocultas, ver CSS .nav-links). */
  if (typeof initNavCategoriesMenu === 'function') initNavCategoriesMenu();
  if (typeof initNavAccountMenu   === 'function') initNavAccountMenu();
  initNavDropdowns();

  /* 6. Cargar favoritos desde la API si hay sesión activa */
  if (isLoggedIn() && typeof loadFavorites === 'function') {
    loadFavorites(); // carga en segundo plano, no bloquea la página
  }

  /* 7. Configurar el drawer (menú lateral) */
  var toggle  = document.getElementById('nav-toggle');  // botón ☰
  var drawer  = document.getElementById('nav-drawer');  // el menú lateral
  var overlay = document.getElementById('drawer-overlay'); // fondo oscuro

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    toggle.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');   // accesibilidad: el drawer es visible
    toggle.setAttribute('aria-label', 'Cerrar menú'); // antes quedaba fijo en "Abrir menú"
    document.body.style.overflow = 'hidden';       // bloquear scroll del fondo
    document.body.classList.add('drawer-is-open'); // oculta la burbuja de WhatsApp (ver style.css)
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    toggle.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');    // accesibilidad: el drawer está oculto
    toggle.setAttribute('aria-label', 'Abrir menú');
    document.body.style.overflow = '';
    document.body.classList.remove('drawer-is-open');
  }

  if (toggle && drawer && overlay) {
    toggle.addEventListener('click', function() {
      drawer.classList.contains('open') ? closeDrawer() : openDrawer();
      // Si está abierto → cerrar; si está cerrado → abrir
    });

    overlay.addEventListener('click', closeDrawer); // clic en el fondo → cerrar

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { closeDrawer(); closeProductModal(); closeChatPanel(); closeNavDropdowns(); }
      // La tecla Escape cierra cualquier cosa abierta (drawer, modal, chat o desplegable)
    });
  }

  /* 8. Nombre de la dulcería en el footer: lleva al inicio.
     Si ya estamos en index.html, en vez de recargar la página hacemos
     scroll suave hasta arriba (mismo efecto que "ir al inicio"). */
  var footerHomeLink = document.getElementById('footer-home-link');
  if (footerHomeLink) {
    footerHomeLink.addEventListener('click', function(e) {
      var path = window.location.pathname;
      var onIndex = path === '/' || path === '' || /\/index\.html$/.test(path);
      if (onIndex) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      // En cualquier otra página se deja el comportamiento normal del link
      // (navegar a index.html).
    });
  }
});

/* ================================================================
   SECCIÓN: CONSTRUCTOR DE TARJETAS DE PRODUCTO
   buildProductCard construye un elemento HTML completo para
   mostrar un producto en el catálogo o en la página de inicio.
   Se llama desde cualquier página que muestre productos.
   Recibe un objeto producto y devuelve un elemento <div> listo
   para insertar en el DOM con appendChild().
================================================================ */
function buildProductCard(product) {
  var card      = document.createElement('div');
  card.className = 'product-card';

  var imgSrc = product.image || '';
  var price  = Number.isInteger(product.price) ? product.price : product.price.toFixed(2);
  // Si el precio es entero (53) lo mostramos sin decimales
  // Si tiene decimales (53.50) lo mostramos con 2 decimales
  var fav    = isFavorite(product.id); // ¿ya es favorito?

  // product.stock puede venir undefined en algún caso viejo/no migrado;
  // en ese caso lo tratamos como "hay existencia" para no romper nada.
  var outOfStock = product.stock !== undefined && product.stock <= 0;

  /* Construimos el HTML de la tarjeta como string.
     Incluye: imagen, botón de favorito, nombre, categoría, precio y botón de carrito */
  card.innerHTML =
    '<div class="card-img-wrap">' +
      '<img class="card-img" src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(product.name) + '" ' +
        'onerror="this.onerror=null;this.src=\'\';this.closest(\'.card-img-wrap\').classList.add(\'no-img\')">' +
        // onerror: si la imagen no carga, agrega la clase no-img para mostrar un fondo de color
      '<button class="card-fav' + (fav ? ' active' : '') + '" data-id="' + product.id + '">' +
        (fav ? '&#10084;&#65039;' : '&#9825;') +
      '</button>' +
      (outOfStock ? '<span class="card-out-badge">Agotado</span>' : '') +
    '</div>' +
    '<div class="card-body">' +
      '<p class="card-name">'  + escapeHtml(product.name)     + '</p>' +
      '<p class="card-cat">'   + escapeHtml(product.category) + '</p>' +
      '<p class="card-price">$' + price            + '</p>' +
    '</div>' +
    '<div class="card-actions">' +
      (outOfStock
        ? '<button class="btn-add" disabled>Agotado</button>'
        : '<button class="btn-add">Agregar al carrito</button>') +
    '</div>';

  /* Clic en la imagen → abre el modal de detalle del producto
     Excepto si el clic fue en el botón de favorito (lo manejamos por separado) */
  card.querySelector('.card-img-wrap').addEventListener('click', function(e) {
    if (e.target.classList.contains('card-fav')) return; // ignorar clic en el corazón
    openProductModal(product.id);
  });
  card.querySelector('.card-img-wrap').style.cursor = 'pointer';

  /* Clic en el corazón → toggle de favorito
     e.stopPropagation() evita que el clic "suba" al card-img-wrap y abra el modal */
  card.querySelector('.card-fav').addEventListener('click', async function(e) {
    e.stopPropagation();
    var nowFav = await toggleFavorite(product.id);
    this.innerHTML = nowFav ? '&#10084;&#65039;' : '&#9825;';
    this.title     = nowFav ? 'Quitar de favoritos' : 'Favorito';
    this.classList.toggle('active', nowFav);
    // Si el modal de este producto estaba abierto, sincronizamos su botón de favorito
    if (_modalProductId === product.id) {
      _updateModalFavBtn(document.getElementById('prod-modal-fav'), nowFav);
    }
  });

  /* Clic en "Agregar al carrito" */
  card.querySelector('.btn-add').addEventListener('click', function() {
    addToCart(product.id);
  });

  return card; // devolvemos el elemento listo para insertar en el HTML
}
