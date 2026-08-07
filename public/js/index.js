/* ============================================================
   INDEX.JS — Dulcería Charles
   Script exclusivo de la página de inicio (index.html).
   Se encarga de:
   1. Cargar los productos destacados desde la API
   2. Mostrar el banner de confirmación de pedido
============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ── Categorías dinámicas: carrusel promocional ─────────────
     Antes era un grid plano de tarjetas; ahora es un carrusel tipo
     banner (2 categorías por slide, degradado de color, flecha al
     catálogo). Los datos siguen viniendo de /api/categorias, así
     que si el admin agrega una categoría nueva aparece sola aquí.
     FALLBACK_CATEGORIAS está definido en auth.js (se reusa el mismo
     respaldo que ya usa el drawer si la API falla).
  ────────────────────────────────────────────────────────────── */
  var catTrack = document.getElementById('cat-promo-track');
  var catDots  = document.getElementById('cat-promo-dots');
  var catPrev  = document.getElementById('cat-promo-prev');
  var catNext  = document.getElementById('cat-promo-next');
  var catAutoplayTimer = null;

  function catCurrentIndex() {
    if (!catTrack.clientWidth) return 0;
    return Math.round(catTrack.scrollLeft / catTrack.clientWidth);
  }

  function catGoToSlide(idx) {
    var slide = catTrack.children[idx];
    if (slide) catTrack.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
  }

  /* El slide índice catDots.children.length (el último hijo de catTrack)
     es un CLON del primer slide, agregado al final en buildCatPromo.
     Sirve para que el auto-avance pueda seguir "de largo" hacia adelante
     en vez de tener que regresar en reversa al llegar al final: cuando
     el scroll aterriza en el clon (que se ve idéntico al slide 0 real),
     saltamos sin animación al slide 0 real — como el clon es visualmente
     igual, el salto es invisible y el carrusel se siente continuo. */
  function catUpdateDots() {
    var realCount = catDots.children.length;
    if (!realCount) return;
    var activeIdx = catCurrentIndex() % realCount;
    Array.prototype.forEach.call(catDots.children, function (dot, i) {
      dot.classList.toggle('active', i === activeIdx);
    });
  }

  function catHandleScrollSettled() {
    var realCount = catDots.children.length;
    if (catCurrentIndex() >= realCount) {
      // Llegamos al slide clonado: saltamos sin animación al real (se ve igual).
      // OJO: como .cat-promo-track tiene "scroll-behavior: smooth" en el CSS,
      // el navegador anima CUALQUIER cambio de scroll por defecto — incluso una
      // asignación directa a scrollLeft. Por eso este "salto invisible" también
      // se animaba (regresando de golpe por todo el carrusel, muy visible).
      // behavior: "instant" es la única forma de saltar sin animación pase lo
      // que diga el CSS.
      catTrack.scrollTo({ left: catTrack.children[0].offsetLeft, behavior: 'instant' });
    }
    catUpdateDots();
  }

  function catStopAutoplay() {
    if (catAutoplayTimer) clearInterval(catAutoplayTimer);
  }

  function catStartAutoplay() {
    catStopAutoplay();
    if (catDots.children.length < 2) return; // un solo slide, no hay nada que rotar
    catAutoplayTimer = setInterval(function () {
      catGoToSlide(catCurrentIndex() + 1); // puede avanzar hasta el slide clonado, sigue girando
    }, 5000);
  }

  function buildCatPromo(cats) {
    if (!catTrack || !cats || !cats.length) return;
    catTrack.innerHTML = '';
    catDots.innerHTML  = '';

    // Agrupamos las categorías de 2 en 2 para armar cada slide
    var slides = [];
    for (var i = 0; i < cats.length; i += 2) slides.push(cats.slice(i, i + 2));

    function buildSlide(pair, slideIdx) {
      var slide = document.createElement('div');
      slide.className = 'cat-promo-slide cat-promo-slide--' + (slideIdx % 4);

      pair.forEach(function (cat) {
        var nombre = escapeHtml(cat.nombre.charAt(0).toUpperCase() + cat.nombre.slice(1));
        var a       = document.createElement('a');
        a.href      = 'catalogo.html?cat=' + encodeURIComponent(cat.nombre);
        a.className = 'cat-promo-item';
        a.innerHTML =
          '<span class="cat-promo-icon-wrap">' + renderCatIcon(cat.icono, '3rem') + '</span>' +
          '<span class="cat-promo-name">' + nombre + '</span>' +
          '<span class="cat-promo-link">Ver categoría <span class="cat-promo-arrow-ic">→</span></span>';
        slide.appendChild(a);
      });
      return slide;
    }

    slides.forEach(function (pair, slideIdx) {
      catTrack.appendChild(buildSlide(pair, slideIdx));

      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'cat-promo-dot' + (slideIdx === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Ir al grupo de categorías ' + (slideIdx + 1));
      dot.addEventListener('click', function () { catGoToSlide(slideIdx); catStartAutoplay(); });
      catDots.appendChild(dot);
    });

    // Clon del primer slide al final, solo para el efecto de loop continuo
    // (ver catHandleScrollSettled). No lleva punto propio ni debe ser
    // alcanzable por teclado, ya que es un duplicado del slide 0 real.
    if (slides.length > 1) {
      var clone = buildSlide(slides[0], 0);
      clone.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(clone.querySelectorAll('a'), function (a) { a.tabIndex = -1; });
      catTrack.appendChild(clone);
    }

    // Con un solo slide (1-2 categorías en total) no hay nada que navegar:
    // ocultamos flechas y puntos para no dejar controles que no hacen nada.
    var single = slides.length <= 1;
    if (catPrev) catPrev.style.display = single ? 'none' : '';
    if (catNext) catNext.style.display = single ? 'none' : '';
    catDots.style.display = single ? 'none' : '';

    catUpdateDots();
    catStartAutoplay();
  }

  if (catTrack) {
    catTrack.addEventListener('scroll', function () {
      clearTimeout(catTrack._scrollTimer);
      catTrack._scrollTimer = setTimeout(catHandleScrollSettled, 80);
    });
    if (catPrev) catPrev.addEventListener('click', function () { catGoToSlide(Math.max(0, catCurrentIndex() - 1)); catStartAutoplay(); });
    if (catNext) catNext.addEventListener('click', function () { catGoToSlide(catCurrentIndex() + 1); catStartAutoplay(); });
    // Pausar el auto-avance mientras el cliente interactúa (mouse o touch)
    catTrack.addEventListener('mouseenter', catStopAutoplay);
    catTrack.addEventListener('mouseleave', catStartAutoplay);
    catTrack.addEventListener('touchstart', catStopAutoplay, { passive: true });

    /* ── Arrastrar con el mouse ──────────────────────────────
       El swipe con el dedo ya funciona solo (el track es un scroll
       nativo), pero un mouse no puede "arrastrar" un overflow:auto
       por su cuenta — eso hay que simularlo a mano.
       OJO: un clic normal con la mano SIEMPRE tiene un poco de
       temblor entre el mousedown y el mouseup — con un umbral muy
       chico (4px) o marcando "dragging" desde el mousedown, ese
       temblor se confundía con un arrastre real y cancelaba el clic,
       dejando los botones de categoría sin funcionar. Ahora la clase
       "dragging" (y su pointer-events:none sobre los links, ver CSS)
       solo se activa DESPUÉS de cruzar el umbral — un clic normal
       nunca la llega a tocar. */
    var CAT_DRAG_THRESHOLD = 8; // px — por debajo de esto, es un clic, no un arrastre
    var catMouseDown = false, catDragging = false, catDragStartX = 0, catDragStartScroll = 0, catDragMoved = false;

    catTrack.addEventListener('mousedown', function (e) {
      catMouseDown = true;
      catDragMoved = false;
      catDragStartX = e.clientX;
      catDragStartScroll = catTrack.scrollLeft;
      catStopAutoplay();
    });

    window.addEventListener('mousemove', function (e) {
      if (!catMouseDown) return;
      var dx = e.clientX - catDragStartX;
      if (!catDragging && Math.abs(dx) > CAT_DRAG_THRESHOLD) {
        catDragging  = true;
        catDragMoved = true;
        catTrack.classList.add('dragging'); // recién aquí se activa cursor grabbing + se apaga scroll-snap
      }
      if (catDragging) catTrack.scrollLeft = catDragStartScroll - dx;
    });

    window.addEventListener('mouseup', function () {
      if (!catMouseDown) return;
      catMouseDown = false;
      if (catDragging) {
        catDragging = false;
        catTrack.classList.remove('dragging');
        catGoToSlide(catCurrentIndex()); // acomoda al slide más cercano al soltar
      }
      catStartAutoplay();
    });

    // Si hubo arrastre real, cancela el clic para que no se abra el link
    // de la categoría justo al soltar el mouse. Un clic normal (catDragMoved
    // nunca llegó a ponerse en true) pasa de largo sin tocarse.
    catTrack.addEventListener('click', function (e) {
      if (catDragMoved) { e.preventDefault(); e.stopPropagation(); catDragMoved = false; }
    }, true);

    apiGetCategorias()
      .then(function (cats) { buildCatPromo(cats && cats.length ? cats : FALLBACK_CATEGORIAS); })
      .catch(function () { buildCatPromo(FALLBACK_CATEGORIAS); });
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
    productos.forEach(function (p, i) {
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
      // Cascada al hacer scroll: cada tarjeta usa el mismo efecto "reveal"
      // que ya existe en el sitio (ver initReveal en cart.js), con un
      // pequeño retraso escalonado (reveal-d1..d4, ciclando) para que no
      // aparezcan todas de golpe sino una detrás de otra.
      card.classList.add('reveal', 'reveal-d' + ((i % 4) + 1));
      grid.appendChild(card);
    });

    // Las tarjetas se agregaron DESPUÉS de que initReveal() ya corrió al
    // cargar la página (esto es async), así que hay que volver a llamarlo
    // para que también las observe a ellas.
    if (typeof initReveal === 'function') initReveal();

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

// Los modales de Términos/Privacidad del footer (antes se abrían solo
// desde aquí) ahora se inicializan en cart.js -> initLegalModals(), que
// se carga en todas las páginas y no solo en index.html.
