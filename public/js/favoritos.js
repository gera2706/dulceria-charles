/* ================================================================
   FAVORITOS.JS — Dulcería Charles
   Script de la página "Mis Favoritos" (favoritos.html).
   Antes vivía inline dentro de favoritos.html — se extrajo aquí
   para seguir el mismo patrón que el resto de páginas del sitio
   (cada página con su .css y .js propios, nada de estilos/scripts
   inline salvo lo estrictamente necesario).
================================================================ */

document.addEventListener('DOMContentLoaded', async function () {
  var grid     = document.getElementById('fav-grid');
  var emptyEl  = document.getElementById('fav-empty');
  var countEl  = document.getElementById('fav-count');
  var clearBtn = document.getElementById('btn-clear-favs');

  async function render() {
    grid.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-light);">Cargando…</p>';
    var products = [];
    try {
      products = await apiGetFavoritos();
      products = products.map(function(p) {
        return Object.assign({}, p, { name: p.nombre, price: parseFloat(p.precio), category: p.categoria, image: p.imagen });
      });
      DC_FAV_CACHE = products.map(function(p) { return p.id; });
    } catch(e) { products = []; }

    grid.innerHTML = '';
    if (!products.length) {
      emptyEl.classList.remove('hidden');
      clearBtn.classList.add('hidden');
      countEl.textContent = '';
      return;
    }
    emptyEl.classList.add('hidden');
    clearBtn.classList.remove('hidden');
    countEl.textContent = products.length + ' producto' + (products.length !== 1 ? 's' : '') + ' guardado' + (products.length !== 1 ? 's' : '');
    products.forEach(function (p) { grid.appendChild(buildProductCard(p)); });
  }

  /* Quitar favorito → recargar vista */
  document.addEventListener('click', function (e) {
    if (e.target.closest('.card-fav')) setTimeout(render, 300);
  });

  /* Limpiar todos */
  clearBtn.addEventListener('click', async function () {
    if (!confirm('¿Quitar todos los favoritos?')) return;
    var ids = getFavorites().slice();
    for (var i = 0; i < ids.length; i++) {
      try { await apiQuitarFavorito(ids[i]); } catch(e) {}
    }
    DC_FAV_CACHE = [];
    render();
  });

  render();
});
