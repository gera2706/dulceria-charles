/* ================================================================
   CATALOGO.JS — Dulcería Charles
   Carga productos y categorías desde la API.
   Los botones de filtro se generan dinámicamente, por lo que
   cuando el admin agrega una categoría nueva en el panel,
   automáticamente aparece como filtro aquí sin tocar el HTML.
================================================================ */

document.addEventListener('DOMContentLoaded', async function () {

  var grid         = document.getElementById('catalog-grid');
  var filterList   = document.getElementById('filter-list');
  var priceRange   = document.getElementById('price-range');
  var priceVal     = document.getElementById('price-val');
  var searchInput  = document.getElementById('search-input');
  var sortSelect   = document.getElementById('sort-select');
  var resultsCount = document.getElementById('results-count');
  var noResults    = document.getElementById('no-results');

  var activeCategory = 'todos';
  var maxPrice       = 400;
  var searchTerm     = '';
  var sortOrder      = 'default';
  var allProducts    = []; // productos cargados desde la API

  /* ── 1. Cargar categorías y construir los botones de filtro ── */
  try {
    var cats = await apiGetCategorias();

    /* Limpiar y reconstruir la lista de filtros */
    filterList.innerHTML = '<li><button class="filter-btn active" data-cat="todos">🍬 Todos</button></li>';
    cats.forEach(function (cat) {
      var li  = document.createElement('li');
      var btn = document.createElement('button');
      btn.className    = 'filter-btn';
      btn.dataset.cat  = cat.nombre;
      btn.innerHTML = renderCatIcon(cat.icono, '1.3rem') +
        ' ' + cat.nombre.charAt(0).toUpperCase() + cat.nombre.slice(1);
      li.appendChild(btn);
      filterList.appendChild(li);
    });
  } catch (e) {
    console.warn('No se pudieron cargar las categorías:', e.message);
    /* Si falla, los botones hardcodeados del HTML se quedan */
  }

  /* ── 2. Leer parámetro ?cat= de la URL ── */
  var urlCat = new URLSearchParams(window.location.search).get('cat');
  if (urlCat) {
    activeCategory = urlCat.toLowerCase();
  }

  /* Marcar el botón activo según la categoría de la URL */
  function syncActiveBtn() {
    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.cat === activeCategory);
    });
  }
  syncActiveBtn();

  /* ── 3. Cargar productos desde la API ── */
  grid.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-light);">Cargando productos…</p>';

  try {
    /* loadProducts() está en data.js: normaliza campos de BD a formato frontend */
    allProducts = await loadProducts();
  } catch (e) {
    grid.innerHTML = '<p style="text-align:center;padding:2rem;color:#e74c3c;">Error al cargar productos.</p>';
    return;
  }

  /* ── 4. Filtrar y mostrar productos ── */
  function renderProducts() {
    var list = allProducts.slice(); // copia para no mutar el original

    /* Filtro de categoría */
    if (activeCategory !== 'todos') {
      list = list.filter(function (p) {
        return (p.category || p.categoria || '').toLowerCase() === activeCategory.toLowerCase();
      });
    }

    /* Filtro de precio máximo */
    list = list.filter(function (p) {
      return (p.price || p.precio || 0) <= maxPrice;
    });

    /* Filtro de búsqueda por texto */
    if (searchTerm) {
      list = list.filter(function (p) {
        return (p.name || p.nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    /* Ordenamiento */
    if (sortOrder === 'price-asc')  list.sort(function (a, b) { return (a.price||0) - (b.price||0); });
    if (sortOrder === 'price-desc') list.sort(function (a, b) { return (b.price||0) - (a.price||0); });
    if (sortOrder === 'name-asc')   list.sort(function (a, b) { return (a.name||'').localeCompare(b.name||''); });

    /* Renderizar tarjetas */
    grid.innerHTML = '';
    list.forEach(function (p) { grid.appendChild(buildProductCard(p)); });

    resultsCount.textContent = list.length === 1
      ? '1 producto encontrado'
      : list.length + ' productos encontrados';

    noResults.classList.toggle('hidden', list.length > 0);
  }

  /* ── 5. Listeners de los filtros (delegado al contenedor) ── */
  filterList.addEventListener('click', function (e) {
    var btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    renderProducts();
  });

  priceRange.addEventListener('input', function () {
    maxPrice = +priceRange.value;
    priceVal.textContent = maxPrice;
    renderProducts();
  });

  searchInput.addEventListener('input', function () {
    searchTerm = searchInput.value.trim();
    renderProducts();
  });

  sortSelect.addEventListener('change', function () {
    sortOrder = sortSelect.value;
    renderProducts();
  });

  /* ── 6. Render inicial ── */
  renderProducts();
});
