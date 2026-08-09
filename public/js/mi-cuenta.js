/* ================================================================
   ARCHIVO: public/js/mi-cuenta.js
   PROPÓSITO: Lógica de la página "Mi cuenta" — antes vivía como
   <script> inline dentro de mi-cuenta.html, se sacó a este archivo
   para poder usar una Content-Security-Policy con script-src 'self'
   (sin 'unsafe-inline') en backend/server.js. El comportamiento es
   exactamente el mismo, solo cambió dónde vive el código.
================================================================ */
var usuarioActual = getCurrentUser();

/* Prellenar el formulario con los datos actuales. apellido/telefono
   pueden no existir todavía en cuentas viejas (creadas antes de que
   existieran esas columnas) — quedan vacíos hasta que se guarden. */
if (usuarioActual) {
  document.getElementById('nombre').value   = usuarioActual.nombre   || '';
  document.getElementById('apellido').value = usuarioActual.apellido || '';
  document.getElementById('telefono').value = usuarioActual.telefono || '';
  document.getElementById('email').value    = usuarioActual.email   || '';
}

/* ── Encabezado + accesos rápidos (cuenta-hub) ──────────────
   Iniciales para el avatar, nombre/correo/rol arriba, y mostrar
   el acceso al panel admin solo si el usuario es admin. */
(function initCuentaHub() {
  if (!usuarioActual) return;

  var nombre   = usuarioActual.nombre   || '';
  var apellido = usuarioActual.apellido || '';
  // Cuentas viejas sin apellido separado: las iniciales se sacan
  // partiendo el nombre completo, igual que antes.
  var iniciales = apellido
    ? ((nombre[0] || '') + (apellido[0] || '')).toUpperCase()
    : nombre.trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase();
  document.getElementById('cuenta-avatar').textContent = iniciales || '🍬';

  document.getElementById('cuenta-header-name').textContent  = (nombre + ' ' + apellido).trim() || 'Mi cuenta';
  document.getElementById('cuenta-header-email').textContent = usuarioActual.email || '';
  document.getElementById('cuenta-header-rol').textContent   =
    usuarioActual.rol === 'admin' ? 'Administrador' : 'Cliente';

  if (usuarioActual.rol === 'admin') {
    document.getElementById('cuenta-card-admin').classList.remove('hidden');
  }

  document.getElementById('cuenta-btn-ayuda').addEventListener('click', function () {
    if (typeof openHelpModal === 'function') openHelpModal();
  });
  document.getElementById('cuenta-btn-salir').addEventListener('click', logout);

  /* "Datos personales" abre el modal de edición. El cierre (X y
     clic fuera) ya lo maneja initLegalModals() de cart.js — el
     modal usa las mismas clases .legal-modal-overlay/.modal-cerrar
     que Términos/Privacidad/Ayuda, así que no hay que repetir esa
     lógica aquí. */
  document.getElementById('cuenta-btn-datos').addEventListener('click', function () {
    document.getElementById('modal-editar-perfil').classList.add('activo');
  });
})();

/* El cambio de contraseña empieza colapsado — se abre con este botón. */
document.getElementById('btn-toggle-password').addEventListener('click', function () {
  var campos = document.getElementById('password-fields');
  var abrir  = campos.classList.contains('hidden');
  campos.classList.toggle('hidden', !abrir);
  this.textContent = abrir ? '🔒 Cancelar cambio de contraseña' : '🔒 Cambiar mi contraseña';
  if (!abrir) {
    // Al cancelar, limpiamos lo escrito — no dejamos una contraseña
    // a medio teclear guardada en un campo invisible.
    ['password-actual', 'password-nueva', 'password-confirmar'].forEach(function (id) {
      document.getElementById(id).value = '';
      document.getElementById('err-' + id).textContent = '';
    });
  }
});

/* Mostrar/ocultar cada campo de contraseña con su propio botón */
document.querySelectorAll('.auth-pass-toggle').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var inp  = document.getElementById(this.dataset.target);
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.querySelector('.pass-eye').style.display     = show ? 'none' : '';
    btn.querySelector('.pass-eye-off').style.display = show ? '' : 'none';
    btn.title = show ? 'Ocultar contraseña' : 'Ver contraseña';
  });
});

document.getElementById('perfil-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  var nombre      = document.getElementById('nombre').value.trim();
  var apellido    = document.getElementById('apellido').value.trim();
  var telefono    = document.getElementById('telefono').value.trim();
  var email       = document.getElementById('email').value.trim();
  var passActual  = document.getElementById('password-actual').value;
  var passNueva   = document.getElementById('password-nueva').value;
  var passConfirm = document.getElementById('password-confirmar').value;

  var globalErr = document.getElementById('global-err');
  var globalOk  = document.getElementById('global-ok');
  var btn       = this.querySelector('button[type=submit]');
  var ok = true;

  ['nombre', 'apellido', 'telefono', 'email', 'password-actual', 'password-nueva', 'password-confirmar'].forEach(function (id) {
    document.getElementById('err-' + id) && (document.getElementById('err-' + id).textContent = '');
    document.getElementById(id).classList.remove('invalid');
  });
  globalErr.classList.remove('visible');
  globalOk.classList.remove('visible');

  if (!nombre) { document.getElementById('err-nombre').textContent = 'Ingresa tu nombre.'; document.getElementById('nombre').classList.add('invalid'); ok = false; }
  if (!email)  { document.getElementById('err-email').textContent  = 'Ingresa tu correo.';  document.getElementById('email').classList.add('invalid');  ok = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('err-email').textContent = 'Ingresa un correo válido.'; document.getElementById('email').classList.add('invalid'); ok = false; }
  // Apellido y teléfono son opcionales — si escriben teléfono, que
  // al menos parezca uno (solo dígitos/espacios/guiones, 7 a 15 caracteres).
  if (telefono && !/^[\d\s-]{7,15}$/.test(telefono)) { document.getElementById('err-telefono').textContent = 'Ingresa un teléfono válido.'; document.getElementById('telefono').classList.add('invalid'); ok = false; }

  // La contraseña solo se valida en el navegador si el usuario quiere cambiarla
  if (passNueva || passConfirm || passActual) {
    if (!passActual) { document.getElementById('err-password-actual').textContent = 'Ingresa tu contraseña actual.'; document.getElementById('password-actual').classList.add('invalid'); ok = false; }
    if (passNueva.length < 8) { document.getElementById('err-password-nueva').textContent = 'Mínimo 8 caracteres.'; document.getElementById('password-nueva').classList.add('invalid'); ok = false; }
    if (passNueva !== passConfirm) { document.getElementById('err-password-confirmar').textContent = 'Las contraseñas no coinciden.'; document.getElementById('password-confirmar').classList.add('invalid'); ok = false; }
  }

  if (!ok) return;

  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    var datos = { nombre: nombre, apellido: apellido, telefono: telefono, email: email };
    if (passNueva) { datos.passwordActual = passActual; datos.passwordNueva = passNueva; }

    var userActualizado = await apiActualizarPerfil(datos);

    document.getElementById('password-actual').value = '';
    document.getElementById('password-nueva').value = '';
    document.getElementById('password-confirmar').value = '';

    // Refresca el encabezado (avatar/nombre) sin tener que recargar
    // la página — apiActualizarPerfil() ya actualizó la sesión guardada.
    usuarioActual = userActualizado;
    var nombreCompleto = ((userActualizado.nombre || '') + ' ' + (userActualizado.apellido || '')).trim();
    document.getElementById('cuenta-header-name').textContent = nombreCompleto || 'Mi cuenta';
    document.getElementById('cuenta-header-email').textContent = userActualizado.email || '';
    var inicialesNuevas = userActualizado.apellido
      ? ((userActualizado.nombre[0] || '') + (userActualizado.apellido[0] || '')).toUpperCase()
      : (userActualizado.nombre || '').trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase();
    document.getElementById('cuenta-avatar').textContent = inicialesNuevas || '🍬';

    globalOk.textContent = 'Tus datos se guardaron correctamente.';
    globalOk.classList.add('visible');
  } catch (err) {
    globalErr.textContent = err.message;
    globalErr.classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
  }
});
