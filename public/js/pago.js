/* ================================================================
   PAGO.JS — Dulcería Charles (modelo pickup, sin envíos)
   Maneja el flujo de checkout en 3 pasos:
   1. Datos de contacto (nombre y teléfono)
   2. Método de pago
   3. Confirmación → genera comprobante
================================================================ */

document.addEventListener('DOMContentLoaded', async function () {


  /* ── Helpers ── */
  function fmt(n) { return '$' + (Number.isInteger(+n) ? +n : parseFloat(n).toFixed(2)); }
  function show(id) { document.getElementById(id).classList.remove('hidden'); }
  function hide(id) { document.getElementById(id).classList.add('hidden'); }
  function val(id)  { return document.getElementById(id).value.trim(); }
  function err(id, msg) {
    var el    = document.getElementById('err-' + id);
    var field = document.getElementById(id);
    if (el)    el.textContent = msg;
    if (field) msg ? field.classList.add('invalid') : field.classList.remove('invalid');
  }

  /* ── Cargar info de pickup desde la API ── */
  try {
    var cfg = await apiGetContacto();
    var dir = (cfg.contacto_direccion || '') + (cfg.contacto_ciudad ? ', ' + cfg.contacto_ciudad : '');
    document.getElementById('pickup-direccion').textContent = dir || '—';

    var horLineas = (cfg.contacto_horario || '').split('|');
    document.getElementById('pickup-horario').innerHTML = horLineas.join('<br>') || '—';
    var pickupTelEl = document.getElementById('pickup-telefono');
    pickupTelEl.textContent = cfg.contacto_telefono || '—';
    pickupTelEl.href = telHref(cfg.contacto_telefono) || '#';
    // El footer de contacto ya no se llena aquí — lo hace initFooterContacto()
    // en cart.js, compartido con el resto de páginas (ver footer-direccion/
    // footer-horario/footer-telefono más abajo en este mismo archivo HTML).
  } catch (e) {
    console.warn('No se pudo cargar info de pickup:', e.message);
  }

  /* ── RETOMAR PEDIDO INCONCLUSO desde pedidos.html ──
     Si viene con ?retomar=ID en la URL, restauramos el pedido y el carrito. */
  var retomar = new URLSearchParams(window.location.search).get('retomar');
  if (retomar) {
    history.replaceState(null, '', 'pago.html');
    sessionStorage.setItem('dc_pedido_id', retomar);
    if (!getCart().length && isLoggedIn()) {
      try {
        var pedidos = await apiGetMisPedidos();
        var pedidoRetomar = pedidos.find(function (p) { return String(p.id) === String(retomar); });
        if (pedidoRetomar && pedidoRetomar.items && pedidoRetomar.items.length) {
          var itemsRestaurados = pedidoRetomar.items.map(function (item) {
            return {
              id:       item.producto_id || item.id,
              name:     item.nombre || item.name,
              category: '',
              price:    parseFloat(item.precio || item.price || 0),
              image:    '',
              qty:      item.cantidad || item.qty || 1
            };
          });
          saveCart(itemsRestaurados);
        }
      } catch (e) {
        console.warn('No se pudo restaurar el carrito:', e.message);
      }
    }
  }

  /* ── Carrito de esta sesión de checkout ──────────────────────
     FIX (auditoría, hallazgo crítico): guardarInconcluso() más abajo
     vacía el carrito del storage (saveCart([])) en cuanto lo guarda
     en la BD, porque a partir de ahí el pedido YA vive en la BD, no
     en el navegador. El problema era que renderSummary()/paso 2/
     confirmar volvían a llamar getCart() DESPUÉS de eso, así que
     encontraban el carrito vacío y el pedido terminaba confirmándose
     con total $0. Ahora se captura una sola copia del carrito aquí
     (después de la restauración de "retomar" pero antes de que
     guardarInconcluso lo vacíe) y esa copia — no el storage — es la
     que se usa en todo el resto del flujo de checkout. ──────────── */
  var checkoutCart = getCart();

  /* ── Resumen lateral ── */
  function renderSummary() {
    var wrap  = document.getElementById('summary-items');
    var total = 0;
    wrap.innerHTML = '';

    checkoutCart.forEach(function (item) {
      total += item.price * item.qty;
      var div = document.createElement('div');
      div.className = 'sum-item';
      div.innerHTML =
        '<img src="' + escapeHtml(item.image || '') + '" alt="' + escapeHtml(item.name) + '" ' +
          'onerror="this.onerror=null;this.style.display=\'none\'">' +
        '<span class="sum-item-name">' + escapeHtml(item.name) + '</span>' +
        '<span class="sum-item-qty">x' + item.qty + '</span>' +
        '<span class="sum-item-price">' + fmt(item.price * item.qty) + '</span>';
      wrap.appendChild(div);
    });

    document.getElementById('sum-total').textContent = fmt(total);
    return { total };
  }

  renderSummary();

  /* ── Guardar pedido como "pendiente_finalizar" al entrar ── */
  (async function guardarInconcluso() {
    if (!isLoggedIn()) return;
    if (sessionStorage.getItem('dc_pedido_id')) return;
    if (!checkoutCart.length) return;
    try {
      var res = await apiPedidoInconcluso({ items: checkoutCart });
      sessionStorage.setItem('dc_pedido_id', res.pedidoId);
      saveCart([]);  /* vaciar el storage — el pedido ya está en la BD.
                        checkoutCart (la copia local) sigue intacta. */
    } catch (e) {
      console.warn('No se pudo guardar pedido:', e.message);
    }
  })();

  /* ── CANCELAR PEDIDO (visible en los 3 pasos del checkout) ──
     Mismo patrón que el botón "✕ Cancelar pedido" de pedidos.js: pide
     un motivo con dcPrompt y llama apiCancelarPedido. La diferencia es
     que aquí no hay que volver a pintar una lista — simplemente se
     limpia todo y se manda al cliente de vuelta al catálogo, para que
     no tenga que ir hasta "Mis Pedidos" a buscar este pedido y
     cancelarlo desde allá. Si por algo no llegó a crearse el pedido en
     la BD (ej. checkoutCart llegó vacío), no hay nada que cancelar en
     el servidor — solo se limpia lo local. */
  document.getElementById('btn-cancel-order').addEventListener('click', async function () {
    var btn = this;
    var motivo = await dcPrompt('¿Por qué quieres cancelar este pedido?', {
      placeholder: 'Ej: agregué un producto de más, ya no lo necesito…',
      required: true,
      okLabel: 'Cancelar pedido',
      cancelLabel: 'Volver'
    });
    if (motivo === null) return; // se arrepintió / cerró el diálogo

    btn.disabled    = true;
    btn.textContent = 'Cancelando…';

    var pedidoId = sessionStorage.getItem('dc_pedido_id');
    try {
      if (pedidoId) await apiCancelarPedido(pedidoId, motivo);
      saveCart([]);
      sessionStorage.removeItem('dc_pedido_id');
      showToast('Pedido cancelado');
      window.location.href = 'catalogo.html';
    } catch (e) {
      btn.disabled    = false;
      btn.textContent = '✕ Cancelar pedido';
      await dcAlert(e.message);
    }
  });

  /* ── Indicadores de paso ── */
  function setStep(n) {
    [1, 2, 3].forEach(function (i) {
      var el = document.getElementById('step-ind-' + i);
      el.classList.remove('active', 'done');
      if (i < n)  el.classList.add('done');
      if (i === n) el.classList.add('active');
    });
    document.querySelectorAll('.step-line').forEach(function (line, idx) {
      line.classList.toggle('done', idx < n - 1);
    });
    [1, 2, 3].forEach(function (i) {
      var sec = document.getElementById('step-' + i);
      i === n ? sec.classList.remove('hidden') : sec.classList.add('hidden');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Paso 1 → 2: validar datos de contacto ── */
  document.getElementById('btn-step1').addEventListener('click', function () {
    var ok = true;
    err('nombre', ''); err('telefono', '');

    if (!val('nombre'))
      { err('nombre', 'Ingresa tu nombre.'); ok = false; }
    if (!/^\d{7,10}$/.test(val('telefono').replace(/\s/g, '')))
      { err('telefono', 'Teléfono inválido (7-10 dígitos).'); ok = false; }

    if (ok) setStep(2);
  });

  /* ── Paso 2 → 3: llenar resumen de confirmación ── */
  document.getElementById('btn-step2').addEventListener('click', function () {
    var method  = document.querySelector('input[name="payment"]:checked').value;
    renderSummary();

    /* Bloque de contacto y pickup */
    document.getElementById('confirm-contact').innerHTML =
      '<h4>📍 Recoger en tienda</h4>' +
      '<p>' + (document.getElementById('pickup-direccion').textContent || '—') + '</p>' +
      '<p><strong>' + escapeHtml(val('nombre')) + '</strong> &nbsp;·&nbsp; +52 ' + escapeHtml(val('telefono')) + '</p>' +
      '';

    /* Bloque de pago */
    document.getElementById('confirm-payment').innerHTML =
      '<h4>💵 Método de pago</h4><p>💵 Efectivo (paga al recoger)</p>';

    /* Lista de items */
    var itemsEl = document.getElementById('confirm-items');
    itemsEl.innerHTML = '';
    checkoutCart.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'confirm-item';
      div.innerHTML =
        '<img src="' + escapeHtml(item.image || '') + '" alt="' + escapeHtml(item.name) + '" ' +
          'onerror="this.onerror=null;this.style.display=\'none\'">' +
        '<div class="confirm-item-info"><strong>' + escapeHtml(item.name) + '</strong><span>x' + item.qty + '</span></div>' +
        '<span class="confirm-item-price">' + fmt(item.price * item.qty) + '</span>';
      itemsEl.appendChild(div);
    });

    setStep(3);
  });

  /* ── Botones Volver ── */
  document.getElementById('btn-back1').addEventListener('click', function () { setStep(1); });
  document.getElementById('btn-back2').addEventListener('click', function () { setStep(2); });

  /* ── CONFIRMAR PEDIDO ── */
  document.getElementById('btn-confirm').addEventListener('click', async function () {
    var btn    = this;
    var method = document.querySelector('input[name="payment"]:checked').value;

    btn.disabled    = true;
    btn.textContent = 'Procesando…';

    var pedidoId = sessionStorage.getItem('dc_pedido_id');
    var orderNum;

    try {
      var datosContacto = {
        metodo_pago:  method,
        nombre_envio: val('nombre'),
        telefono:     val('telefono')
      };
      /* El precio/total ya NO se manda desde aquí: el servidor los
         recalcula siempre desde los precios reales en la BD (ver
         backend/routes/pedidos.js, construirItemsValidados). */

      if (pedidoId) {
        /* Actualizar el inconcluso existente a "pendiente_entregar" */
        await apiCompletarPedido(pedidoId, datosContacto);
        orderNum = pedidoId;
      } else {
        /* Crear pedido completo si no había inconcluso */
        var res = await apiCrearPedido(Object.assign({ items: checkoutCart }, datosContacto));
        orderNum = res.pedidoId;
      }

      /* Limpiar datos temporales */
      saveCart([]);
      sessionStorage.removeItem('dc_pedido_id');

      /* Redirigir al comprobante con el número de pedido */
      window.location.href = 'comprobante.html?pedido=' + orderNum;

    } catch (e) {
      btn.disabled    = false;
      btn.textContent = '✅ Confirmar pedido 🎉';
      // Antes se anteponía "Error al procesar el pedido: " a e.message,
      // lo que quedaba redundante con mensajes como el de falta de stock
      // (ya escrito en tono de disculpa desde el backend, ver pedidos.js).
      // Los mensajes del backend ya están redactados para mostrarse solos.
      await dcAlert(e.message);
    }
  });

});
