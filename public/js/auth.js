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

/* ── Saludo personalizado en el encabezado del drawer ──
   Antes de iniciar sesión se muestra "🍬 Menú". Al iniciar sesión
   se reemplaza por un saludo tipo "Hola, {primer nombre}". ── */
function initDrawerGreeting() {
  var header = document.querySelector('#nav-drawer .drawer-header');
  if (!header) return;
  var user = getCurrentUser();
  if (user && user.nombre) {
    header.textContent = '👋 Hola, ' + user.nombre.split(' ')[0];
  }
}

/* ── Inyectar sección de auth en el nav drawer ── */
function initAuthDrawer() {
  var drawer = document.getElementById('nav-drawer');
  if (!drawer) return;

  initDrawerGreeting();

  var hr = document.createElement('hr');
  hr.style.cssText = 'border:none;border-top:1px solid rgba(255,255,255,0.18);margin:0.8rem 0 0.4rem;';
  drawer.appendChild(hr);

  var ICON_LOCK     = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.7a4 4 0 0 1 8 0V11"/></svg>';
  var ICON_USERPLUS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.5" cy="8" r="3.3"/><path d="M3.5 20a6 6 0 0 1 12 0"/><path d="M18 7.5v4.5M15.7 9.7h4.6"/></svg>';
  var ICON_USER     = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>';
  var ICON_SETTINGS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="1.7"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="16" cy="12" r="1.7"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="10" cy="18" r="1.7"/></svg>';
  var ICON_HELP     = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a2.7 2.7 0 0 1 5.2 1c0 1.7-2.2 1.8-2.4 3.5"/><circle cx="12" cy="16.8" r="0.2"/></svg>';
  var ICON_LOGOUT   = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3.5"/><path d="m15.5 16 4-4-4-4"/><path d="M19.2 12H9.5"/></svg>';

  var user = getCurrentUser();

  if (!user) {
    var loginA = document.createElement('a');
    loginA.href      = 'login.html';
    loginA.innerHTML = ICON_LOCK + ' Iniciar sesión';

    var regA = document.createElement('a');
    regA.href      = 'registro.html';
    regA.innerHTML = ICON_USERPLUS + ' Crear cuenta';

    drawer.appendChild(loginA);
    drawer.appendChild(regA);

  } else {
    /* El nombre y el rol ya se muestran en el saludo del encabezado
       (initDrawerGreeting), así que aquí solo va una lista limpia de
       accesos de cuenta, al estilo "Ayuda y configuración" de Amazon. */
    var accTitle = document.createElement('div');
    accTitle.className = 'drawer-cats-title';
    accTitle.textContent = 'Ayuda y configuración';
    drawer.appendChild(accTitle);

    var cuentaA = document.createElement('a');
    cuentaA.href      = 'mi-cuenta.html';
    cuentaA.innerHTML = ICON_USER + ' Mi cuenta';
    drawer.appendChild(cuentaA);

    if (user.rol === 'admin') {
      var adminA = document.createElement('a');
      adminA.href      = 'admin.html';
      adminA.innerHTML = ICON_SETTINGS + ' Panel de administración';
      drawer.appendChild(adminA);
    }

    var ayudaA = document.createElement('a');
    ayudaA.href      = 'contacto.html';
    ayudaA.innerHTML = ICON_HELP + ' Ayuda';
    drawer.appendChild(ayudaA);

    var logoutBtn = document.createElement('button');
    logoutBtn.className   = 'drawer-logout-btn';
    logoutBtn.innerHTML   = ICON_LOGOUT + ' Salir';
    logoutBtn.addEventListener('click', logout);
    drawer.appendChild(logoutBtn);
  }
}

/* ── Sección "Categorías" dentro del drawer ──
   Inspirada en el menú de cuenta de Amazon: lista de accesos rápidos
   con ícono + flecha, cargada dinámicamente desde /api/categorias
   (así que si el admin agrega una categoría nueva, aparece sola). ── */
var FALLBACK_CATEGORIAS = [
  { nombre: 'bombones',   icono: '🍡' },
  { nombre: 'botanas',    icono: '🍿' },
  { nombre: 'chocolates', icono: '🍫' },
  { nombre: 'enchilados', icono: '🌶️' },
  { nombre: 'gomitas',    icono: '🐻' },
  { nombre: 'mazapanes',  icono: '🥜' },
  { nombre: 'paletas',    icono: '🍭' },
  { nombre: 'refrescos',  icono: '🥤' }
];

function initDrawerCategories() {
  var wrap = document.getElementById('drawer-cats');
  if (!wrap) return;

  var ICON_CHEV = '<svg class="ic chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>';

  function render(cats) {
    if (!cats || !cats.length) return;
    var title = document.createElement('div');
    title.className = 'drawer-cats-title';
    title.textContent = 'Categorías';
    wrap.appendChild(title);

    cats.forEach(function (cat) {
      var a = document.createElement('a');
      a.href      = 'catalogo.html?cat=' + encodeURIComponent(cat.nombre);
      a.className = 'drawer-cat-item';
      var iconHtml = typeof renderCatIcon === 'function' ? renderCatIcon(cat.icono, '1.15rem') : '🍬';
      a.innerHTML =
        iconHtml +
        '<span>' + cat.nombre.charAt(0).toUpperCase() + cat.nombre.slice(1) + '</span>' +
        ICON_CHEV;
      wrap.appendChild(a);
    });
  }

  if (typeof apiGetCategorias !== 'function') { render(FALLBACK_CATEGORIAS); return; }

  apiGetCategorias()
    .then(function (cats) { render(cats && cats.length ? cats : FALLBACK_CATEGORIAS); })
    .catch(function () { render(FALLBACK_CATEGORIAS); });
}
