/* ============================================================
   AUTH — Dulcería Charles
   Lee la sesión del storage (guardada por api.js tras login/registro)
============================================================ */

function getCurrentUser() {
  return JSON.parse(
    localStorage.getItem('dc_session') ||
    sessionStorage.getItem('dc_session') ||
    'null'
  );
}
function isLoggedIn() { return getCurrentUser() !== null; }
function isAdmin()    { var u = getCurrentUser(); return u && u.rol === 'admin'; }
function isCliente()  { var u = getCurrentUser(); return u && (u.rol === 'cliente' || u.rol === 'admin'); }

function logout() {
  localStorage.removeItem('dc_session');
  sessionStorage.removeItem('dc_session');
  localStorage.removeItem('dc_token');
  sessionStorage.removeItem('dc_token');
  localStorage.removeItem('dc_cart');          /* limpiar carrito al cerrar sesión */
  sessionStorage.removeItem('dc_pedido_id');   /* limpiar pedido inconcluso */
  window.location.href = 'index.html';
}

function requireLogin() {
  if (!isLoggedIn()) {
    var page = window.location.pathname.split('/').pop() || 'index.html';
    window.location.href = 'login.html?next=' + encodeURIComponent(page);
  }
}

/* ── Inyectar sección de auth en el nav drawer ── */
function initAuthDrawer() {
  var drawer = document.getElementById('nav-drawer');
  if (!drawer) return;

  var hr = document.createElement('hr');
  hr.style.cssText = 'border:none;border-top:1px solid rgba(255,255,255,0.25);margin:0.8rem 0 0.4rem;';
  drawer.appendChild(hr);

  var user = getCurrentUser();

  if (!user) {
    var loginA = document.createElement('a');
    loginA.href      = 'login.html';
    loginA.innerHTML = '🔐 Iniciar sesión';

    var regA = document.createElement('a');
    regA.href      = 'registro.html';
    regA.innerHTML = '✨ Crear cuenta';

    drawer.appendChild(loginA);
    drawer.appendChild(regA);

  } else {
    var tag   = document.createElement('div');
    tag.className = 'drawer-user-tag';
    var icon  = user.rol === 'admin' ? '⚙️' : '👤';
    var badge = user.rol === 'admin'
      ? '<span class="drawer-role-badge admin">Admin</span>'
      : '<span class="drawer-role-badge cliente">Cliente</span>';
    tag.innerHTML = icon + ' <strong>' + user.nombre + '</strong>' + badge;
    drawer.appendChild(tag);

    if (user.rol === 'admin') {
      var adminA = document.createElement('a');
      adminA.href      = 'admin.html';
      adminA.innerHTML = '🛠️ Panel de administración';
      drawer.appendChild(adminA);
    }

    var logoutBtn = document.createElement('button');
    logoutBtn.className   = 'drawer-logout-btn';
    logoutBtn.textContent = '🚪 Cerrar sesión';
    logoutBtn.addEventListener('click', logout);
    drawer.appendChild(logoutBtn);
  }
}
