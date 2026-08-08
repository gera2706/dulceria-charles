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

  /* Todo lo de cargar + pintar la lista está en una función propia
     (antes era código suelto en el DOMContentLoaded) para poder
     volver a llamarla después de cancelar un pedido, sin recargar
     toda la página. */
  await cargarYRenderizarPedidos();

  /* El botón "limpiar historial" ya no aplica porque los pedidos
     están en la BD (no en localStorage), así que lo ocultamos */
  var btnClear = document.getElementById('btn-clear');
  if (btnClear) btnClear.style.display = 'none';

  async function cargarYRenderizarPedidos() {
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

    /* El cliente puede cancelar mientras el pedido no se haya entregado
       ni esté ya cancelado. Uno "entregado" es un caso de devolución/
       reclamo, no un simple cancelar — ese pasa por hablarle a la
       tienda, no por este botón (ver también POST /:id/cancelar). */
    var puedeCancelar = order.estado === 'pendiente_finalizar' || order.estado === 'pendiente_entregar';
    var cancelBtnHtml = puedeCancelar
      ? '<button type="button" class="btn-cancelar-pedido" data-pedido="' + order.id + '" ' +
          'style="background:none;color:#b91c1c;border:1.5px solid #e2685f;padding:0.45rem 1rem;' +
          'border-radius:50px;font-weight:700;font-size:0.82rem;cursor:pointer;">' +
          '✕ Cancelar pedido' +
        '</button>'
      : '';

    /* Total a mostrar en el encabezado — calculado desde items si el campo es 0
       (calcTotalPedido está en js/cart.js, compartida con admin.js/comprobante.js) */
    var headerTotal = calcTotalPedido(order);

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
       Los items vienen con campos de BD: nombre/precio/cantidad, y
       stock_actual (agregado en el backend, ver agruparPedidosConItems
       en routes/pedidos.js) — null si el producto ya no existe,
       un número (incluido 0) si sigue existiendo. Solo nos importa
       para marcar "Agotado" en pedidos que siguen incompletos: uno ya
       entregado o confirmado no cambia aunque el producto se agote
       después, ese cliente ya se llevó lo que compró. */
    var items = order.items || [];
    var itemsAgotados = isInconcluso
      ? items.filter(function (item) { return item.stock_actual !== null && item.stock_actual !== undefined && item.stock_actual <= 0; })
      : [];
    var itemsHtml = items.length
      ? items.map(function (item) {
          var nombre  = escapeHtml(item.nombre || item.name || '—');
          var precio  = parseFloat(item.precio || item.price || 0);
          var qty     = item.cantidad || item.qty || 1;
          var agotado = isInconcluso && item.stock_actual !== null && item.stock_actual !== undefined && item.stock_actual <= 0;
          return '<div class="pedido-item">' +
            '<div class="pedido-item-info"><strong>' + nombre + '</strong><span>x' + qty + '</span>' +
              (agotado ? '<span style="color:#b91c1c;font-weight:700;font-size:0.78rem;">🚫 Agotado</span>' : '') +
            '</div>' +
            '<span class="pedido-item-price">' + fmt(precio * qty) + '</span>' +
          '</div>';
        }).join('')
      : '<p style="color:var(--text-light);font-size:0.85rem;">Sin detalle de productos.</p>';

    /* Si el total en BD es 0 (pedido de prueba), calculamos desde los items */
    var totalReal = calcTotalPedido(order);

    var totalsHtml =
      '<div class="pedido-totals">' +
        '<div class="row total-row"><span>Total</span><span>' + fmt(totalReal) + '</span></div>' +
      '</div>';

    /* Contenido del cuerpo varía según si el pedido está incompleto o no */
    if (isInconcluso) {
      /* Pedido inconcluso: aviso distinto según si lo que dejó a medias
         sigue disponible o ya se agotó mientras tanto. Si algo se
         agotó, ya no tiene caso ofrecer "Continuar compra" (el backend
         lo va a rechazar de todos modos, ver validarYDescontarStock) —
         en vez de eso se ofrece avisar al dueño. */
      var avisoHtml;
      if (itemsAgotados.length) {
        avisoHtml =
          '<div class="pedido-section" style="background:#fdecea;border-radius:10px;padding:0.8rem 1rem;margin-bottom:0.8rem;">' +
            '<p style="margin:0 0 0.6rem;font-size:0.88rem;color:#7f1d1d;">🚫 <strong>' +
              (itemsAgotados.length > 1 ? 'Estos productos ya no están disponibles' : (escapeHtml(itemsAgotados[0].nombre) + ' ya no está disponible')) +
            '</strong> — se agotaron antes de que terminaras la compra. Ya no se puede continuar con este pedido tal cual.</p>' +
            '<button type="button" class="btn-avisar-dueno" data-pedido="' + order.id + '" ' +
              'style="background:#b91c1c;color:#fff;border:none;padding:0.5rem 1.1rem;border-radius:50px;font-weight:700;font-size:0.85rem;cursor:pointer;margin-right:0.5rem;">' +
              '🔔 Avisar al dueño' +
            '</button>' +
            cancelBtnHtml +
            '<span class="aviso-dueno-msg" style="display:none;margin-left:0.6rem;font-size:0.85rem;color:#7f1d1d;font-weight:700;">✅ Ya le avisamos, gracias</span>' +
          '</div>';
      } else {
        avisoHtml =
          '<div class="pedido-section" style="background:#fff8e1;border-radius:10px;padding:0.8rem 1rem;margin-bottom:0.8rem;">' +
            '<p style="margin:0 0 0.6rem;font-size:0.88rem;color:#92400e;">⚠️ Este pedido quedó <strong>incompleto</strong>. ' +
            /* El link lleva a pago.html con el ID del pedido para retomarlo */
            '<a href="pago.html?retomar=' + order.id + '" style="color:#d97706;font-weight:700;">Continuar compra →</a></p>' +
            cancelBtnHtml +
          '</div>';
      }
      body.innerHTML =
        avisoHtml +
        '<div class="pedido-section"><h4>🍬 Productos</h4></div>' +
        '<div class="pedido-items">' + itemsHtml + '</div>' +
        totalsHtml;

      // Botón "Avisar al dueño": manda un aviso por cada producto agotado
      // de este pedido (normalmente solo hay uno). Se deshabilita después
      // para que no se pueda mandar de nuevo por accidente.
      var btnAvisar = body.querySelector('.btn-avisar-dueno');
      if (btnAvisar) {
        btnAvisar.addEventListener('click', async function () {
          btnAvisar.disabled = true;
          btnAvisar.textContent = 'Avisando…';
          try {
            for (const item of itemsAgotados) {
              await apiAvisarAgotado(order.id, item.producto_id);
            }
            btnAvisar.style.display = 'none';
            body.querySelector('.aviso-dueno-msg').style.display = 'inline';
          } catch (e) {
            btnAvisar.disabled = false;
            btnAvisar.textContent = '🔔 Avisar al dueño';
            await dcAlert(e.message);
          }
        });
      }
    } else {
      /* Pedido completo (o cancelado/entregado): info de pickup, método
         de pago y productos. Si quedó cancelado, mostramos quién lo
         canceló y por qué — útil tanto si lo canceló el cliente (para
         recordarlo) como si lo canceló la tienda (para que sepa la razón). */
      var canceladoHtml = '';
      if (order.estado === 'cancelado') {
        var quien = order.cancelado_por === 'admin' ? 'La tienda canceló este pedido' : 'Cancelaste este pedido';
        canceladoHtml =
          '<div class="pedido-section" style="background:#fdecea;border-radius:10px;padding:0.8rem 1rem;margin-bottom:0.8rem;">' +
            '<p style="margin:0;font-size:0.88rem;color:#7f1d1d;">✕ <strong>' + quien + '</strong>' +
              (order.motivo_cancelacion ? ' — ' + escapeHtml(order.motivo_cancelacion) : '') +
            '</p>' +
          '</div>';
      }
      body.innerHTML =
        canceladoHtml +
        (cancelBtnHtml ? '<div class="pedido-section" style="text-align:right;">' + cancelBtnHtml + '</div>' : '') +
        '<div class="pedido-section">' +
          '<h4>📍 Recoger en tienda</h4>' +
          '<p><strong>' + escapeHtml(order.nombre_envio || '—') + '</strong>' +
            (order.telefono ? ' &nbsp;·&nbsp; +52 ' + escapeHtml(order.telefono) : '') + '</p>' +
        '</div>' +
        '<div class="pedido-section">' +
          '<h4>💳 Método de pago</h4>' +
          '<span class="pago-badge">' +
            (PAGO_ICONS[order.metodo_pago] || '') + ' ' + (PAGO_NAMES[order.metodo_pago] || order.metodo_pago || '—') +
          '</span>' +
        '</div>' +
        '<div class="pedido-section"><h4>🍬 Productos</h4></div>' +
        '<div class="pedido-items">' + itemsHtml + '</div>' +
        totalsHtml +
        '<div style="margin-top:1rem;text-align:right;">' +
          '<a href="comprobante.html?pedido=' + order.id + '" ' +
            'style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.85rem;font-weight:700;' +
            'color:var(--purple-dark);border:1.5px solid var(--purple);padding:0.4rem 1rem;' +
            'border-radius:50px;text-decoration:none;transition:background 0.2s;" ' +
            'onmouseover="this.style.background=\'rgba(167,139,250,0.12)\'" ' +
            'onmouseout="this.style.background=\'transparent\'">' +
            '🖨️ Ver comprobante' +
          '</a>' +
        '</div>';
    }

    // Botón "Cancelar pedido": puede aparecer en cualquiera de las tres
    // ramas de arriba (inconcluso normal, inconcluso agotado, o
    // confirmado/pendiente por entregar) — un solo listener cubre los
    // tres casos porque solo hay uno por tarjeta.
    var btnCancelar = body.querySelector('.btn-cancelar-pedido');
    if (btnCancelar) {
      btnCancelar.addEventListener('click', async function () {
        var motivo = await dcPrompt('¿Por qué quieres cancelar el pedido #' + order.id + '?', {
          placeholder: 'Ej: ya no lo necesito, lo pedí por error…',
          required: true,
          okLabel: 'Cancelar pedido',
          cancelLabel: 'Volver'
        });
        if (motivo === null) return; // se arrepintió / cerró el diálogo

        btnCancelar.disabled = true;
        btnCancelar.textContent = 'Cancelando…';
        try {
          await apiCancelarPedido(order.id, motivo);
          await cargarYRenderizarPedidos(); // vuelve a pintar la lista con el estado ya actualizado
        } catch (err) {
          btnCancelar.disabled = false;
          btnCancelar.textContent = '✕ Cancelar pedido';
          await dcAlert(err.message);
        }
      });
    }

    card.appendChild(header);
    card.appendChild(body);
    list.appendChild(card);

    /* El primer pedido (más reciente) se muestra abierto automáticamente */
    if (idx === 0) card.classList.add('open');
  });
  } // fin cargarYRenderizarPedidos()
});
