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
   ┌────────────────┬──────────────────┬──────────────────────────────┐
   │ Tipo usuario   │ Dónde se guarda  │ Cuándo se borra              │
   ├────────────────┼──────────────────┼──────────────────────────────┤
   │ Visitante      │ sessionStorage   │ Al cerrar la pestaña         │
   │ Registrado     │ localStorage     │ Solo al vaciar el carrito    │
   └────────────────┴──────────────────┴──────────────────────────────┘
   Esto imita el comportamiento de tiendas reales: si eres cliente
   registrado, tu carrito persiste entre visitas. Si eres visitante,
   se limpia al cerrar el navegador.
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

/* Lee el carrito guardado en el storage del navegador.
   Usa JSON.parse porque el storage solo guarda texto, no objetos.
   Si no hay carrito, devuelve un array vacío [] en lugar de null. */
function getCart() {
  if (isLoggedIn()) {
    return JSON.parse(localStorage.getItem('dc_cart') || '[]');
    // isLoggedIn() está en auth.js, devuelve true si hay sesión activa
  }
  return JSON.parse(sessionStorage.getItem('dc_cart') || '[]');
}

/* Guarda el carrito actualizado en el storage.
   JSON.stringify convierte el array de objetos a texto para poder guardarlo.
   Después de guardar, actualiza el número del badge en la navbar. */
function saveCart(c) {
  if (isLoggedIn()) {
    localStorage.setItem('dc_cart', JSON.stringify(c));
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
    var userCart = JSON.parse(localStorage.getItem('dc_cart') || '[]');

    visitorCart.forEach(function(item) {
      var existing = userCart.find(function(i) { return i.id === item.id; });
      if (existing) {
        existing.qty += item.qty; // el producto ya estaba → sumamos cantidades
      } else {
        userCart.push(item); // producto nuevo → lo agregamos
      }
    });

    localStorage.setItem('dc_cart', JSON.stringify(userCart));
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
   Devuelve true si se AGREGÓ, false si se QUITÓ. */
function toggleFavorite(id) {
  var favs  = getFavorites();
  var idx   = favs.indexOf(id);
  var added = idx === -1; // si no estaba en la lista → se va a agregar

  if (isLoggedIn()) {
    if (added) {
      favs.push(id);
      DC_FAV_CACHE = favs;
      apiAgregarFavorito(id).catch(console.warn);
      // .catch(console.warn) → si la API falla, solo imprime un aviso
      // pero no rompe la UI (el corazón ya cambió visualmente)
    } else {
      favs.splice(idx, 1); // splice(posición, cuántos eliminar) → borra 1 elemento
      DC_FAV_CACHE = favs;
      apiQuitarFavorito(id).catch(console.warn);
    }
  } else {
    // Visitante: solo guardamos en sessionStorage (sin API)
    if (added) favs.push(id); else favs.splice(idx, 1);
    sessionStorage.setItem('dc_favorites', JSON.stringify(favs));
  }
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
================================================================ */
function showToast(msg) {
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

  toast.textContent     = '🛒 ' + msg;
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
  favBtn.onclick = function() {
    var nowFav = toggleFavorite(productId);
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
  }, { threshold: 0.1 });
  // threshold: 0.1 = la animación se activa cuando el 10% del elemento es visible

  els.forEach(function(el) { observer.observe(el); }); // observamos cada elemento
}

/* ================================================================
   SECCIÓN: INICIALIZACIÓN AL CARGAR LA PÁGINA
   Este bloque se ejecuta cuando el HTML termina de cargarse.
   Inicializa todos los comportamientos globales.
================================================================ */
document.addEventListener('DOMContentLoaded', function() {

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

  /* 5. Inicializar el drawer de autenticación (definido en auth.js) */
  initAuthDrawer();

  /* 5b. Cargar la sección "Categorías" del drawer (definida en auth.js) */
  if (typeof initDrawerCategories === 'function') initDrawerCategories();

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
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    toggle.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');    // accesibilidad: el drawer está oculto
    toggle.setAttribute('aria-label', 'Abrir menú');
    document.body.style.overflow = '';
  }

  if (toggle && drawer && overlay) {
    toggle.addEventListener('click', function() {
      drawer.classList.contains('open') ? closeDrawer() : openDrawer();
      // Si está abierto → cerrar; si está cerrado → abrir
    });

    overlay.addEventListener('click', closeDrawer); // clic en el fondo → cerrar

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { closeDrawer(); closeProductModal(); }
      // La tecla Escape cierra cualquier cosa abierta (drawer o modal)
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
  card.querySelector('.card-fav').addEventListener('click', function(e) {
    e.stopPropagation();
    var nowFav = toggleFavorite(product.id);
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
