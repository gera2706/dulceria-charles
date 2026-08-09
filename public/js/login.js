/* ================================================================
   ARCHIVO: public/js/login.js
   PROPÓSITO: Lógica de la página de login — antes vivía como
   <script> inline dentro de login.html, se sacó a este archivo para
   poder usar una Content-Security-Policy con script-src 'self' (sin
   'unsafe-inline') en backend/server.js. El comportamiento es
   exactamente el mismo, solo cambió dónde vive el código.
================================================================ */

/* Si ya está logueado, redirigir */
(function() {
  if (isLoggedIn()) {
    var params = new URLSearchParams(window.location.search);
    window.location.href = params.get('next') || 'index.html';
  }
})();

/* "Recuérdame": solo guarda el CORREO (nunca la contraseña) para no
   tener que volver a escribirlo. La sesión en sí ya no se mantiene
   iniciada entre visitas por seguridad — ver saveToken() en api.js.
   La contraseña la puede ofrecer autocompletar el propio navegador
   (los campos ya tienen autocomplete="email"/"current-password"). */
(function() {
  var rememberedEmail = localStorage.getItem('dc_remembered_email');
  if (rememberedEmail) {
    document.getElementById('email').value = rememberedEmail;
    document.getElementById('remember').checked = true;
  }
})();

/* Toggle password */
(function() {
  var btn = document.getElementById('toggle-pass');
  btn.addEventListener('click', function() {
    var inp  = document.getElementById('password');
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.querySelector('.pass-eye').style.display     = show ? 'none' : '';
    btn.querySelector('.pass-eye-off').style.display = show ? '' : 'none';
    btn.title = show ? 'Ocultar contraseña' : 'Ver contraseña';
  });
})();

/* Submit */
document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var email     = document.getElementById('email').value.trim();
  var password  = document.getElementById('password').value;
  var remember  = document.getElementById('remember').checked;
  var globalErr = document.getElementById('global-err');
  var btn       = this.querySelector('button[type=submit]');
  var ok = true;

  ['email','password'].forEach(function(id) {
    document.getElementById('err-' + id).textContent = '';
    document.getElementById(id).classList.remove('invalid');
  });
  globalErr.classList.remove('visible');

  if (!email)    { document.getElementById('err-email').textContent = 'Ingresa tu correo.'; document.getElementById('email').classList.add('invalid'); ok = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('err-email').textContent = 'Ingresa un correo válido.'; document.getElementById('email').classList.add('invalid'); ok = false; }
  if (!password) { document.getElementById('err-password').textContent = 'Ingresa tu contraseña.'; document.getElementById('password').classList.add('invalid'); ok = false; }
  if (!ok) return;

  btn.disabled = true;
  btn.textContent = 'Iniciando sesión…';

  try {
    await apiLogin(email, password);
    if (remember) localStorage.setItem('dc_remembered_email', email);
    else localStorage.removeItem('dc_remembered_email');
    var params = new URLSearchParams(window.location.search);
    window.location.href = params.get('next') || 'index.html';
  } catch (err) {
    globalErr.textContent = err.message;
    globalErr.classList.add('visible');
    btn.disabled = false;
    btn.textContent = 'Iniciar sesión';
  }
});
