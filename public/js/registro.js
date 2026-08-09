/* ================================================================
   ARCHIVO: public/js/registro.js
   PROPÓSITO: Lógica de la página de registro — antes vivía como
   <script> inline dentro de registro.html, se sacó a este archivo
   para poder usar una Content-Security-Policy con script-src 'self'
   (sin 'unsafe-inline') en backend/server.js.
================================================================ */

/* Si ya está logueado, redirigir */
(function() {
  if (isLoggedIn()) window.location.href = 'index.html';
})();

/* Toggle password */
function togglePass(btnId, inputId) {
  var btn = document.getElementById(btnId);
  btn.addEventListener('click', function() {
    var inp  = document.getElementById(inputId);
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.querySelector('.pass-eye').style.display     = show ? 'none' : '';
    btn.querySelector('.pass-eye-off').style.display = show ? '' : 'none';
    btn.title = show ? 'Ocultar contraseña' : 'Ver contraseña';
  });
}
togglePass('toggle-pass',  'password');
togglePass('toggle-pass2', 'password2');

/* Submit */
document.getElementById('register-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var nombre    = document.getElementById('nombre').value.trim();
  var email     = document.getElementById('email').value.trim();
  var password  = document.getElementById('password').value;
  var password2 = document.getElementById('password2').value;
  var globalErr = document.getElementById('global-err');
  var btn       = this.querySelector('button[type=submit]');
  var ok = true;

  ['nombre','email','password','password2'].forEach(function(id) {
    document.getElementById('err-' + id).textContent = '';
    document.getElementById(id).classList.remove('invalid');
  });
  globalErr.classList.remove('visible');

  if (!nombre) {
    document.getElementById('err-nombre').textContent = 'Ingresa tu nombre.';
    document.getElementById('nombre').classList.add('invalid'); ok = false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('err-email').textContent = 'Ingresa un correo válido.';
    document.getElementById('email').classList.add('invalid'); ok = false;
  }
  if (password.length < 8) {
    document.getElementById('err-password').textContent = 'Mínimo 8 caracteres.';
    document.getElementById('password').classList.add('invalid'); ok = false;
  }
  if (password !== password2) {
    document.getElementById('err-password2').textContent = 'Las contraseñas no coinciden.';
    document.getElementById('password2').classList.add('invalid'); ok = false;
  }
  if (!ok) return;

  btn.disabled = true;
  btn.textContent = 'Creando cuenta…';

  try {
    await apiRegistro(nombre, email, password);
    window.location.href = 'catalogo.html';
  } catch (err) {
    globalErr.textContent = err.message;
    globalErr.classList.add('visible');
    btn.disabled = false;
    btn.textContent = 'Crear mi cuenta';
  }
});
