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
  var PAGO_NAMES = { efectivo: 'Efectivo al recoger', tarjeta: 'Tarjeta de crédito / débito', transferencia: 'Transferencia / SPEI' };

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

  /* ── Calcular totales (calcTotalPedido está en js/cart.js) ── */
  var total = calcTotalPedido(pedido);
  var estadoInfo = ESTADO_INFO[pedido.estado] || { label: pedido.estado, color: '#999' };
  var cancelado = pedido.estado === 'cancelado';

  /* El bloque de "confirmado" antes era siempre igual (palomita verde +
     "¡Pedido confirmado!") sin importar el estado real — un pedido
     cancelado se veía IGUAL que uno vigente, con el único aviso en el
     badge chiquito de más abajo. Riesgo real: alguien en la tienda ve
     el comprobante, ve la palomita verde y surte un pedido que ya no
     debía surtirse. Si está cancelado, cambia a ✕ roja y texto claro
     de que no se debe entregar. */
  var confirmHtml = cancelado
    ? '<div class="check-circle check-circle--cancel">✕</div>' +
      '<span class="confirmed-title confirmed-title--cancel">Pedido cancelado</span>' +
      '<span class="confirmed-sub">No entregar — este pedido ya no está vigente.' +
        (pedido.motivo_cancelacion ? ' Motivo: ' + escapeHtml(pedido.motivo_cancelacion) + '.' : '') +
      '</span>'
    : '<div class="check-circle">✓</div>' +
      '<span class="confirmed-title">¡Pedido confirmado!</span>' +
      '<span class="confirmed-sub">Tu pedido ha sido registrado exitosamente.</span>';

  /* ── Info de la tienda ── */
  var storeDir = (cfg.contacto_direccion || '') + (cfg.contacto_ciudad ? ', ' + cfg.contacto_ciudad : '');
  var storeHor = (cfg.contacto_horario  || '').split('|').join(' | ');
  var storeTel = cfg.contacto_telefono || '—';
  var storeTelHref = telHref(cfg.contacto_telefono);

  /* ── Construir HTML del comprobante ── */
  var items = pedido.items || [];

  var itemsRows = items.map(function (item) {
    var nombre = escapeHtml(item.nombre || item.name || '—');
    var precio = parseFloat(item.precio || item.price || 0);
    var qty    = item.cantidad || item.qty || 1;
    return '<div class="item-row">' +
      '<span class="item-name">' + nombre + '</span>' +
      '<span class="item-qty">' + qty + '</span>' +
      '<span class="item-price">' + fmt(precio) + '</span>' +
      '<span class="item-total">' + fmt(precio * qty) + '</span>' +
    '</div>';
  }).join('');

  wrapper.innerHTML =
    '<div class="ticket">' +
      '<div class="ticket-inner">' +

        /* Cabecera */
        '<div class="ticket-header">' +
          '<div class="brand-name">🍬 Dulcería Charles</div>' +
          '<div class="brand-sub">Endulzando tu vida desde 2020</div>' +
        '</div>' +
        '<hr class="t-dash">' +

        /* Confirmado (o cancelado, ver confirmHtml arriba) */
        '<div class="confirmed">' +
          confirmHtml +
        '</div>' +
        '<hr class="t-dash">' +

        /* Número de pedido */
        '<div class="order-num">' +
          '<div class="order-label">Número de pedido</div>' +
          '<div class="order-number">#' + String(pedido.id).padStart(4, '0') + '</div>' +
          '<div class="order-date">' + fmtFecha(pedido.fecha) + '</div>' +
          '<div><span class="estado-badge" style="background:' + estadoInfo.color + '22;color:' + estadoInfo.color + ';">' + estadoInfo.label + '</span></div>' +
        '</div>' +
        '<hr class="t-dash">' +

        /* Datos de contacto */
        '<div class="section-label">Datos de contacto</div>' +
        '<div class="info-row"><span class="lbl">Nombre</span><span>' + escapeHtml(pedido.nombre_envio || '—') + '</span></div>' +
        '<div class="info-row"><span class="lbl">Teléfono</span><span>+52 ' + escapeHtml(pedido.telefono || '—') + '</span></div>' +
        '<div class="info-row"><span class="lbl">Pago</span><span>' +
          (PAGO_ICONS[pedido.metodo_pago] || '💵') + ' ' + (PAGO_NAMES[pedido.metodo_pago] || pedido.metodo_pago || '—') +
        '</span></div>' +
        '<hr class="t-dash">' +

        /* Productos */
        '<div class="section-label">Productos</div>' +
        '<div class="items-header">' +
          '<span style="flex:1">Artículo</span>' +
          '<span style="width:24px;text-align:center">Cant</span>' +
          '<span style="width:44px;text-align:right">P/U</span>' +
          '<span style="width:48px;text-align:right">Total</span>' +
        '</div>' +
        itemsRows +
        '<div class="total-row"><span>TOTAL</span><span>' + fmt(total) + '</span></div>' +
        '<hr class="t-dash">' +

        /* Pickup */
        '<div class="section-label">Información de pickup</div>' +
        '<div class="pickup-block">' +
          '🏪 <strong>Dulcería Charles</strong><br>' +
          '📍 ' + (storeDir || '—') + '<br>' +
          '🕐 ' + (storeHor || '—') + '<br>' +
          '📞 ' + (storeTelHref ? '<a href="' + storeTelHref + '">' + storeTel + '</a>' : storeTel) +
          (cancelado
            ? '<span class="pickup-note" style="color:var(--t-error);">✕ Este pedido está cancelado, no hay nada que recoger.</span>'
            : '<span class="pickup-note">✅ Presenta este comprobante al recoger tu pedido.</span>') +
        '</div>' +
        '<hr class="t-dash">' +

        /* Footer del ticket — antes traía "hola@dulceriacharles.com" fijo
           en el código (una dirección que ni siquiera existe), en vez
           del correo real configurado en Configuración > Contacto (el
           resto del ticket ya usaba cfg.contacto_email para todo lo
           demás, esto se había quedado suelto). */
        '<div class="ticket-footer">' +
          '<span class="gracias">¡Gracias por tu compra!</span>' +
          '<p>' + escapeHtml(cfg.contacto_email || '—') + '<br>★ ★ ★ ★ ★</p>' +
        '</div>' +

      '</div>' +
    '</div>' +

    /* Botones fuera del ticket */
    '<div class="comp-actions">' +
      '<button class="btn-print" onclick="window.print()">🖨️ Imprimir</button>' +
      '<a href="pedidos.html" class="btn-home">📦 Mis pedidos</a>' +
      '<a href="index.html" class="btn-home">🏠 Inicio</a>' +
    '</div>';

  /* Limpiar sessionStorage del pedido ya que ya tenemos el comprobante */
  sessionStorage.removeItem('dc_pedido_id');
});
