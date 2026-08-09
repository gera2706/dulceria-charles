/* ================================================================
   ARCHIVO: public/js/olvide-password.js
   PROPÓSITO: Lógica de la página "Olvidé mi contraseña" — antes vivía
   como <script> inline dentro de olvide-password.html, se sacó a
   este archivo para poder usar una Content-Security-Policy con
   script-src 'self' (sin 'unsafe-inline') en backend/server.js.
================================================================ */

/* Si ya está logueado, no tiene sentido estar aquí */
(function() {
  if (isLoggedIn()) window.location.href = 'index.html';
})();

document.getElementById('olvide-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var email     = document.getElementById('email').value.trim();
  var globalErr = document.getElementById('global-err');
  var btn       = this.querySelector('button[type=submit]');

  document.getElementById('err-email').textContent = '';
  document.getElementById('email').classList.remove('invalid');
  globalErr.classList.remove('visible');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('err-email').textContent = 'Ingresa un correo válido.';
    document.getElementById('email').classList.add('invalid');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    // El backend siempre responde "ok" exista o no la cuenta —
    // por diseño, para no delatar qué correos están registrados.
    // Por eso aquí no hay un "catch" que muestre un error distinto
    // al de verdad fallar la conexión con el servidor.
    await apiOlvidePassword(email);
    document.getElementById('paso-pedir').classList.add('hidden');
    document.getElementById('paso-enviado').classList.remove('hidden');
  } catch (err) {
    globalErr.textContent = err.message;
    globalErr.classList.add('visible');
    btn.disabled = false;
    btn.textContent = 'Enviar link de recuperación';
  }
});
