/* ================================================================
   COMPROBANTE.JS — Dulcería Charles
   Muestra el comprobante de pedido después de confirmar la compra.
   Lee el ID del pedido desde la URL (?pedido=5) y carga los datos
   desde la API para mostrar el recibo completo.
================================================================ */

document.addEventListener('DOMContentLoaded', async function () {

  var wrapper = document.getElementById('comp-wrapper');

  /* Helpers */
  function fmt(n) {
    var num = parseFloat(n) || 0;
    return '$' + (Number.isInteger(num) ? num : num.toFixed(2));
  }
  function fmtFecha(str) {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  var PAGO_ICONS = { efectivo: '💵', tarjeta: '💳', transferencia: '🏦' };
  var PAGO_NAMES = { efectivo: 'Efectivo (paga al recoger)', tarjeta: 'Tarjeta de crédito / débito', transferencia: 'Transferencia / SPEI' };

  var ESTADO_INFO = {
    pendiente_entregar:  { label: 'Pendiente por entregar', color: '#8b5cf6' },
    pendiente_finalizar: { label: 'Pendiente por finalizar', color: '#f59e0b' },
    entregado:           { label: 'Entregado', color: '#10b981' },
    cancelado:           { label: 'Cancelado', color: '#ef4444' },
  };

  /* ── Leer el número de pedido de la URL ── */
  var params   = new URLSearchParams(window.location.search);
  var pedidoId = params.get('pedido');

  if (!pedidoId || !isLoggedIn()) {
    wrapper.innerHTML = '<div class="comp-loading" style="color:#e74c3c;">No se encontró el pedido.<br><a href="pedidos.html">Ver mis pedidos</a></div>';
    return;
  }

  /* ── Cargar datos del pedido y la info de la tienda ── */
  var pedido, cfg;
  try {
    [pedido, cfg] = await Promise.all([
      apiGetPedido(pedidoId),
      apiGetContacto()
    ]);
  } catch (e) {
    wrapper.innerHTML = '<div class="comp-loading" style="color:#e74c3c;">Error al cargar el comprobante: ' + e.message + '<br><a href="pedidos.html">Ver mis pedidos</a></div>';
    return;
  }

  /* ── Calcular totales ── */
  var total = parseFloat(pedido.total || 0);
  /* Si el total en BD es 0, calculamos desde items */
  if (!total && pedido.items && pedido.items.length) {
    total = pedido.items.reduce(function (s, i) {
      return s + parseFloat(i.precio || i.price || 0) * (i.cantidad || i.qty || 1);
    }, 0);
  }
  var estadoInfo = ESTADO_INFO[pedido.estado] || { label: pedido.estado, color: '#999' };

  /* ── Info de la tienda ── */
  var storeDir = (cfg.contacto_direccion || '') + (cfg.contacto_ciudad ? ', ' + cfg.contacto_ciudad : '');
  var storeHor = (cfg.contacto_horario  || '').split('|').join(' | ');
  var storeTel = cfg.contacto_telefono || '—';

  /* ── Construir HTML del comprobante ── */
  var items = pedido.items || [];

  var itemsRows = items.map(function (item) {
    var nombre = item.nombre || item.name || '—';
    var precio = parseFloat(item.precio || item.price || 0);
    var qty    = item.cantidad || item.qty || 1;
    return '<tr>' +
      '<td>' + nombre + '</td>' +
      '<td style="text-align:center;">' + qty + '</td>' +
      '<td>' + fmt(precio) + '</td>' +
      '<td>' + fmt(precio * qty) + '</td>' +
      '</tr>';
  }).join('');


  wrapper.innerHTML =
    /* Encabezado de éxito */
    '<div class="comp-success">' +
      '<div class="comp-checkmark">✓</div>' +
      '<h1>¡Pedido confirmado!</h1>' +
      '<p>Tu pedido ha sido registrado exitosamente.</p>' +
    '</div>' +

    /* Número de pedido */
    '<div class="comp-order-num">' +
      '<div class="label">Número de pedido</div>' +
      '<div class="number">#' + String(pedido.id).padStart(4, '0') + '</div>' +
      '<div class="date">' + fmtFecha(pedido.fecha) + '</div>' +
      '<div style="margin-top:0.6rem;">' +
        '<span class="estado-badge" style="background:' + estadoInfo.color + '20;color:' + estadoInfo.color + ';">' +
          estadoInfo.label +
        '</span>' +
      '</div>' +
    '</div>' +

    /* Datos del cliente */
    '<div class="comp-card">' +
      '<h3>👤 Datos de contacto</h3>' +
      '<p style="margin:0.2rem 0;"><strong>' + (pedido.nombre_envio || '—') + '</strong></p>' +
      '<p style="margin:0.2rem 0;color:var(--text-light);">+52 ' + (pedido.telefono || '—') + '</p>' +
    '</div>' +

    /* Método de pago */
    '<div class="comp-card">' +
      '<h3>💳 Método de pago</h3>' +
      '<p style="margin:0;">' +
        (PAGO_ICONS[pedido.metodo_pago] || '') + ' ' +
        (PAGO_NAMES[pedido.metodo_pago] || pedido.metodo_pago || '—') +
      '</p>' +
    '</div>' +

    /* Productos */
    '<div class="comp-card">' +
      '<h3>🍬 Productos</h3>' +
      '<table class="comp-items">' +
        '<thead><tr><th>Producto</th><th style="text-align:center;">Cant.</th><th>Precio</th><th>Total</th></tr></thead>' +
        '<tbody>' + itemsRows + '</tbody>' +
      '</table>' +
      '<div class="comp-totals">' +
        '<div class="row total"><span>Total</span><span>' + fmt(total) + '</span></div>' +
      '</div>' +
    '</div>' +

    /* Info de pickup */
    '<div class="comp-card">' +
      '<h3>📍 Información de pickup</h3>' +
      '<div class="pickup-box">' +
        '<p>🏪 <strong>Dulcería Charles</strong></p>' +
        '<p>📍 ' + (storeDir || '—') + '</p>' +
        '<p>🕐 ' + (storeHor || '—') + '</p>' +
        '<p>📞 ' + storeTel + '</p>' +
        '<p style="margin-top:0.8rem;font-weight:700;color:#15803d;">✅ Presenta este comprobante al recoger tu pedido.</p>' +
      '</div>' +
    '</div>' +

    /* Acciones */
    '<div class="comp-actions">' +
      '<button class="btn-print" onclick="window.print()">🖨️ Imprimir comprobante</button>' +
      '<a href="pedidos.html" class="btn-home">📦 Ver mis pedidos</a>' +
      '<a href="index.html" class="btn-home">🏠 Ir al inicio</a>' +
    '</div>';

  /* Limpiar sessionStorage del pedido ya que ya tenemos el comprobante */
  sessionStorage.removeItem('dc_pedido_id');
});
