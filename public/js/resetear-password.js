/* ================================================================
   ARCHIVO: public/js/resetear-password.js
   PROPÓSITO: Lógica de la página "Restablecer contraseña" — antes
   vivía como <script> inline dentro de resetear-password.html, se
   sacó a este archivo para poder usar una Content-Security-Policy
   con script-src 'self' (sin 'unsafe-inline') en backend/server.js.
================================================================ */

/* El token viaja como ?token=xxxx en la URL, generado por el
   backend en olvide-password (ver enviarCorreoReseteo en
   backend/mailer.js). Sin token no hay nada que hacer aquí. */
var _token = new URLSearchParams(window.location.search).get('token');

if (!_token) {
  document.getElementById('paso-form').classList.add('hidden');
  document.getElementById('paso-sin-token').classList.remove('hidden');
}

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

document.getElementById('reset-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var password  = document.getElementById('password').value;
  var password2 = document.getElementById('password2').value;
  var globalErr = document.getElementById('global-err');
  var btn       = this.querySelector('button[type=submit]');
  var ok = true;

  ['password', 'password2'].forEach(function(id) {
    document.getElementById('err-' + id).textContent = '';
    document.getElementById(id).classList.remove('invalid');
  });
  globalErr.classList.remove('visible');

  if (!password || password.length < 8) {
    document.getElementById('err-password').textContent = 'Mínimo 8 caracteres.';
    document.getElementById('password').classList.add('invalid');
    ok = false;
  }
  if (password2 !== password) {
    document.getElementById('err-password2').textContent = 'No coincide con la contraseña de arriba.';
    document.getElementById('password2').classList.add('invalid');
    ok = false;
  }
  if (!ok) return;

  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    await apiResetearPassword(_token, password);
    document.getElementById('paso-form').classList.add('hidden');
    document.getElementById('paso-exito').classList.remove('hidden');
  } catch (err) {
    globalErr.textContent = err.message; // ej. "El link de recuperación es inválido o ya expiró."
    globalErr.classList.add('visible');
    btn.disabled = false;
    btn.textContent = 'Guardar contraseña nueva';
  }
});
