/* ============================================================
   INDEX.JS — Dulcería Charles
   Script exclusivo de la página de inicio (index.html).
   Se encarga de:
   1. Cargar los productos destacados desde la API
   2. Mostrar el banner de confirmación de pedido
============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ── Categorías dinámicas desde la BD ───────────────────────
     Carga las categorías desde /api/categorias y construye las
     tarjetas del grid. Si el admin agrega "Refrescos" en el panel,
     automáticamente aparece aquí la próxima vez que se cargue la página.
  ────────────────────────────────────────────────────────────── */
  var catsGrid = document.getElementById('categories-grid');
  if (catsGrid) {
    apiGetCategorias().then(function (cats) {
      catsGrid.innerHTML = '';
      cats.forEach(function (cat) {
        var a       = document.createElement('a');
        a.href      = 'catalogo.html?cat=' + encodeURIComponent(cat.nombre);
        a.className = 'cat-card';
        a.innerHTML = renderCatIcon(cat.icono, '3.5rem') +
          '<h3>' + cat.nombre.charAt(0).toUpperCase() + cat.nombre.slice(1) + '</h3>';
        catsGrid.appendChild(a);
      });
    }).catch(function () { /* si falla la API, las tarjetas ya estaban en el HTML */ });
  }

  /* ── Productos destacados ──────────────────────────────────
     Pedimos al servidor solo los productos marcados como ⭐.
     Mientras cargan mostramos "Cargando..." y si falla
     mostramos un mensaje de error.
  ────────────────────────────────────────────────────────── */
  var grid = document.getElementById('featured-grid');
  grid.innerHTML = '<p style="color:var(--text-light);font-size:0.9rem;padding:1rem;">Cargando…</p>';

  apiGetProductos({ destacado: true }).then(function (productos) {
    grid.innerHTML = ''; // limpiamos el "Cargando..."

    if (!productos.length) {
      grid.innerHTML = '<p style="color:var(--text-light);font-size:0.9rem;padding:1rem;">Sin productos destacados por el momento.</p>';
      return;
    }

    /* Normalizamos los campos de la BD (nombre/precio) al formato
       que espera buildProductCard (name/price) */
    productos.forEach(function (p) {
      var card = buildProductCard({
        id:           p.id,
        name:         p.nombre,
        category:     p.categoria,
        price:        parseFloat(p.precio), // parseFloat porque MySQL devuelve strings
        image:        p.imagen || '',
        featured:     !!p.destacado,
        stock:        p.stock,
        stock_minimo: p.stock_minimo
      });
      grid.appendChild(card);
    });

  }).catch(function () {
    grid.innerHTML = '<p style="color:#e74c3c;font-size:0.9rem;padding:1rem;">Error al cargar productos destacados.</p>';
  });

  /* ── Banner de confirmación de pedido ─────────────────────
     Cuando el usuario termina de pagar, pago.html redirige
     a index.html?pedido=123. Aquí detectamos ese parámetro
     y mostramos un banner de felicitación durante 9 segundos.
  ────────────────────────────────────────────────────────── */
  var params   = new URLSearchParams(window.location.search);
  var orderNum = params.get('pedido'); // leemos el número de pedido de la URL

  if (orderNum) {
    // Limpiamos el parámetro de la URL para que no quede visible
    history.replaceState(null, '', 'index.html');

    // Animación de entrada del banner
    var style = document.createElement('style');
    style.textContent = '@keyframes slideDown{from{transform:translateY(-100%)}to{transform:translateY(0)}}';
    document.head.appendChild(style);

    // Creamos el banner con los estilos inline
    var banner = document.createElement('div');
    banner.id  = 'order-success-banner';
    Object.assign(banner.style, {
      position:'fixed', top:'0', left:'0', right:'0', zIndex:'500',
      background:'linear-gradient(135deg,#ff6b9d,#a855f7)',
      color:'#fff', padding:'0.9rem 1.5rem', textAlign:'center',
      fontFamily:'Nunito,sans-serif', fontWeight:'700', fontSize:'0.97rem',
      display:'flex', alignItems:'center', justifyContent:'center', gap:'1rem',
      flexWrap:'wrap', boxShadow:'0 4px 20px rgba(168,85,247,0.35)',
      animation:'slideDown 0.4s ease',
    });
    banner.innerHTML =
      '<span style="font-size:1.4rem">&#127881;</span>' +
      '<span>Pedido #' + orderNum + ' confirmado! Gracias por tu compra en Dulceria Charles.</span>' +
      '<a href="pedidos.html" style="background:rgba(255,255,255,0.25);padding:0.3rem 1rem;border-radius:50px;color:#fff;font-size:0.85rem;white-space:nowrap;">Ver mis pedidos</a>' +
      '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fff;font-size:1.4rem;cursor:pointer;line-height:1;padding:0;">x</button>';

    document.body.prepend(banner);

    // El banner desaparece solo después de 9 segundos
    setTimeout(function () { if (banner.parentElement) banner.remove(); }, 9000);
  }

});
