/* ================================================================
   CAT-ICON.JS — Dulcería Charles
   Función compartida para renderizar el icono de una categoría.
   El campo "icono" puede contener:
     - Un emoji:    "🍬"  → se muestra como texto
     - Una URL:     "img/categorias/refrescos.jpg"
                    "https://ejemplo.com/img.png"
                    → se muestra como <img>
   Ambos casos quedan dentro del mismo <span class="cat-icon"> para
   que ocupen el mismo espacio y se vean visualmente iguales.
================================================================ */

/* Escape mínimo y autocontenido: no depende de que cart.js (escapeHtml
   global) ya se haya cargado, porque el orden de <script> varía entre
   páginas y este archivo se usa en las 12. */
function _catIconEscape(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCatIcon(icono, size) {
  size = size || '3rem';
  if (!icono) icono = '🍬';

  /* Si parece una URL → imagen dentro de un span contenedor */
  var esImagen = /^https?:\/\//i.test(icono) ||
                 /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(icono) ||
                 icono.startsWith('img/');

  if (esImagen) {
    return '<span class="cat-icon cat-icon--img" style="font-size:' + size + ';' +
      'display:inline-flex;align-items:center;justify-content:center;' +
      'width:1em;height:1em;">' +
      '<img src="' + _catIconEscape(icono) + '" alt="categoría" class="cat-icon__img"' +
      ' onerror="this.style.display=\'none\'">' +
      '</span>';
  }

  /* Emoji u otro texto */
  return '<span class="cat-icon" style="font-size:' + size + ';">' + _catIconEscape(icono) + '</span>';
}
