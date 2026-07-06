/* ============================================================
   PEDIDOS.JS — Dulcería Charles
   Script de la página "Mis Pedidos" (pedidos.html).
   Carga el historial de pedidos del usuario desde la API
   y los muestra con toda su información.
   Los pedidos inconclusos tienen un aviso especial para
   que el usuario pueda retomar la compra.
============================================================ */

document.addEventListener('DOMContentLoaded', async function () {

  /* Referencias a elementos del HTML */
  var list    = document.getElementById('pedidos-list');
  var empty   = document.getElementById('pedidos-empty');
  var actions = document.getElementById('pedidos-actions');

  /* Iconos y nombres para los métodos de pago */
  var PAGO_ICONS = { efectivo: '💵', tarjeta: '💳', transferencia: '🏦' };
  var PAGO_NAMES = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'SPEI' };

  /* Colores y etiquetas para cada estado de pedido */
  var ESTADO_INFO = {
    pendiente_finalizar: { label: 'Pendiente por finalizar', color: '#f59e0b' }, // amarillo — no terminó la compra
    pendiente_entregar:  { label: 'Pendiente por entregar',  color: '#8b5cf6' }, // morado  — listo para recoger
    entregado:           { label: 'Entregado',               color: '#10b981' }, // verde   — ya recogió
    cancelado:           { label: 'Cancelado',               color: '#ef4444' }, // rojo    — cancelado
  };

  /* Formatea números como precios: fmt(53) → "$53", fmt(53.5) → "$53.50" */
  function fmt(n) {
    var num = parseFloat(n) || 0;
    return '$' + (Number.isInteger(num) ? num : num.toFixed(2));
  }

  /* Formatea fechas de la BD en formato legible: "29 may 2026" */
  function fmtFecha(str) {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('es-MX', { year:'numeric', month:'short', day:'numeric' });
  }

  /* ── Verificar sesión ──────────────────────────────────────
     Si no hay sesión activa, mostramos un mensaje y no
     intentamos cargar pedidos (evitaría un error 401).
  ────────────────────────────────────────────────────────── */
  if (!isLoggedIn()) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:2rem;">Inicia sesión para ver tus pedidos.</p>';
    if (empty)   empty.classList.add('hidden');
    if (actions) actions.classList.add('hidden');
    return;
  }

  /* Mostramos estado de carga mientras esperamos la respuesta */
  list.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:2rem;">Cargando pedidos…</p>';

  /* ── Cargar pedidos desde la API ──────────────────────── */
  var orders = [];
  try {
    orders = await apiGetMisPedidos(); // petición al servidor
  } catch (e) {
    list.innerHTML = '<p style="text-align:center;color:#e74c3c;padding:2rem;">Error al cargar pedidos: ' + e.message + '</p>';
    return;
  }

  /* Si no hay pedidos, mostramos el estado vacío */
  if (!orders.length) {
    list.innerHTML = '';
    if (empty)   empty.classList.remove('hidden');
    if (actions) actions.classList.add('hidden');
    return;
  }

  if (empty)   empty.classList.add('hidden');
  if (actions) actions.classList.remove('hidden');
  list.innerHTML = '';

  /* ── Renderizar cada pedido ────────────────────────────── */
  orders.forEach(function (order, idx) {
    var estadoInfo   = ESTADO_INFO[order.estado] || { label: order.estado, color: '#999' };
    var isInconcluso = order.estado === 'pendiente_finalizar'; // pedidos sin completar

    /* Total a mostrar en el encabezado — calculado desde items si el campo es 0 */
    var headerTotal = parseFloat(order.total || 0);
    if (!headerTotal && (order.items || []).length) {
      headerTotal = (order.items || []).reduce(function (s, i) {
        return s + parseFloat(i.precio || i.price || 0) * (i.cantidad || i.qty || 1);
      }, 0);
    }

    /* Creamos la tarjeta del pedido */
    var card = document.createElement('div');
    card.className = 'pedido-card';

    /* ── Encabezado de la tarjeta (número, fecha, estado, total) ── */
    var header = document.createElement('div');
    header.className = 'pedido-header';
    header.innerHTML =
      '<div>' +
        '<div class="pedido-num">Pedido #' + order.id + '</div>' +
        '<div class="pedido-fecha">' + fmtFecha(order.fecha) + '</div>' +
      '</div>' +
      /* Badge de color con el estado del pedido */
      '<span class="pedido-status" style="background:' + estadoInfo.color + '20;color:' + estadoInfo.color + ';padding:3px 12px;border-radius:50px;font-size:0.8rem;font-weight:700;">' +
        estadoInfo.label +
      '</span>' +
      '<span class="pedido-total">' + fmt(headerTotal) + '</span>' +
      '<span class="pedido-chevron">▼</span>';

    /* Al hacer clic en el encabezado, se abre/cierra el detalle */
    header.addEventListener('click', function () { card.classList.toggle('open'); });

    /* ── Cuerpo de la tarjeta (productos, dirección, pago) ── */
    var body = document.createElement('div');
    body.className = 'pedido-body';

    /* Lista de productos del pedido
       Los items vienen con campos de BD: nombre/precio/cantidad */
    var items = order.items || [];
    var itemsHtml = items.length
      ? items.map(function (item) {
          var nombre = item.nombre || item.name || '—';
          var precio = parseFloat(item.precio || item.price || 0);
          var qty    = item.cantidad || item.qty || 1;
          return '<div class="pedido-item">' +
            '<div class="pedido-item-info"><strong>' + nombre + '</strong><span>x' + qty + '</span></div>' +
            '<span class="pedido-item-price">' + fmt(precio * qty) + '</span>' +
          '</div>';
        }).join('')
      : '<p style="color:var(--text-light);font-size:0.85rem;">Sin detalle de productos.</p>';

    /* Si el total en BD es 0 (pedido de prueba), calculamos desde los items */
    var totalReal = parseFloat(order.total || 0);
    if (!totalReal && items.length) {
      totalReal = items.reduce(function (s, i) {
        return s + parseFloat(i.precio || i.price || 0) * (i.cantidad || i.qty || 1);
      }, 0);
    }

    var totalsHtml =
      '<div class="pedido-totals">' +
        '<div class="row total-row"><span>Total</span><span>' + fmt(totalReal) + '</span></div>' +
      '</div>';

    /* Contenido del cuerpo varía según si el pedido está incompleto o no */
    if (isInconcluso) {
      /* Pedido inconcluso: mostramos aviso y botón para continuar */
      body.innerHTML =
        '<div class="pedido-section" style="background:#fff8e1;border-radius:10px;padding:0.8rem 1rem;margin-bottom:0.8rem;">' +
          '<p style="margin:0;font-size:0.88rem;color:#92400e;">⚠️ Este pedido quedó <strong>incompleto</strong>. ' +
          /* El link lleva a pago.html con el ID del pedido para retomarlo */
          '<a href="pago.html?retomar=' + order.id + '" style="color:#d97706;font-weight:700;">Continuar compra →</a></p>' +
        '</div>' +
        '<div class="pedido-section"><h4>🍬 Productos</h4></div>' +
        '<div class="pedido-items">' + itemsHtml + '</div>' +
        totalsHtml;
    } else {
      /* Pedido completo: mostramos info de pickup, método de pago y productos */
      body.innerHTML =
        '<div class="pedido-section">' +
          '<h4>📍 Recoger en tienda</h4>' +
          '<p><strong>' + (order.nombre_envio || '—') + '</strong>' +
            (order.telefono ? ' &nbsp;·&nbsp; +52 ' + order.telefono : '') + '</p>' +
        '</div>' +
        '<div class="pedido-section">' +
          '<h4>💳 Método de pago</h4>' +
          '<span class="pago-badge">' +
            (PAGO_ICONS[order.metodo_pago] || '') + ' ' + (PAGO_NAMES[order.metodo_pago] || order.metodo_pago || '—') +
          '</span>' +
        '</div>' +
        '<div class="pedido-section"><h4>🍬 Productos</h4></div>' +
        '<div class="pedido-items">' + itemsHtml + '</div>' +
        totalsHtml;
    }

    card.appendChild(header);
    card.appendChild(body);
    list.appendChild(card);

    /* El primer pedido (más reciente) se muestra abierto automáticamente */
    if (idx === 0) card.classList.add('open');
  });

  /* El botón "limpiar historial" ya no aplica porque los pedidos
     están en la BD (no en localStorage), así que lo ocultamos */
  var btnClear = document.getElementById('btn-clear');
  if (btnClear) btnClear.style.display = 'none';
});
