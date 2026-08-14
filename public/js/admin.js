/* ============================================================
   ADMIN PANEL JS — Dulcería Charles  (API version)
============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  function fmt(n) { return '$' + (isNaN(n) ? '0' : Number.isInteger(+n) ? +n : parseFloat(n).toFixed(2)); }

  // El cálculo de total-con-respaldo-desde-items vive en calcTotalPedido()
  // (js/cart.js), compartida con pedidos.js y comprobante.js.

  /* ══ Navegación lateral ══ */
  var navBtns = document.querySelectorAll('.admin-nav-btn');
  navBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      navBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(function (s) { s.classList.remove('active'); });
      document.getElementById('sec-' + btn.dataset.section).classList.add('active');

      // La vista previa del chatbot (burbuja + panel) solo tiene sentido
      // mientras se está en la sección Chatbot — si no, se queda flotando
      // sobre el resto del panel admin sin servir de nada. Se quita por
      // completo del DOM (no solo se cierra) al salir de la sección; el
      // botón "🧪 Probar chatbot" la vuelve a crear cuando se necesite.
      if (btn.dataset.section !== 'chatbot' && typeof removeChatbotPreview === 'function') removeChatbotPreview();

      if (btn.dataset.section === 'dashboard')     renderDashboard();
      if (btn.dataset.section === 'productos')     renderProductos();
      if (btn.dataset.section === 'pedidos')       renderPedidos();
      if (btn.dataset.section === 'usuarios')      renderUsuarios();
      if (btn.dataset.section === 'configuracion') renderConfiguracion();
      if (btn.dataset.section === 'chatbot')       renderChatbotFaqs();
      if (btn.dataset.section === 'auditorias')    renderAuditorias();
      if (btn.dataset.section === 'historial')     renderHistorial();
      if (btn.dataset.section === 'respaldos')     renderRespaldos();
    });
  });

  /* ══════════════════════════════════════
     DASHBOARD
  ══════════════════════════════════════ */
  async function renderDashboard() {
    try {
      // apiGetHistorialCambios() con su propio .catch(): si esta llamada
      // falla (ej. sesión vieja, endpoint caído) no debe tumbar TODO el
      // dashboard — simplemente la tarjeta de "Cambios recientes" queda en 0.
      var [productos, pedidos, usuarios, historial] = await Promise.all([
        apiGetProductos(),
        apiGetTodosPedidos(),
        apiGetUsuarios(),
        apiGetHistorialCambios({}).catch(function () { return []; })
      ]);

      var clientes    = usuarios.filter(function (u) { return u.rol !== 'admin'; });
      var inconclusos = pedidos.filter(function (o) { return o.estado === 'pendiente_finalizar'; }).length;
      var confirmados = pedidos.filter(function (o) {
        return o.estado !== 'pendiente_finalizar' && o.estado !== 'cancelado';
      }).length;
      /* Ingresos = todos los pedidos confirmados (pendiente_entregar + entregado)
         excluimos pendiente_finalizar (no pagaron) y cancelado */
      var revenue = pedidos
        .filter(function (o) { return o.estado === 'pendiente_entregar' || o.estado === 'entregado'; })
        .reduce(function (s, o) { return s + calcTotalPedido(o); }, 0);

      /* Stock bajo: tiene existencias pero ya llegó (o pasó) su umbral de alerta.
         Agotado: no queda ni una pieza. Ambos casos van en la misma tarjeta
         de alerta para que el admin los vea de un vistazo. */
      var bajoStock = productos.filter(function (p) { return p.stock > 0 && p.stock <= p.stock_minimo; });
      var agotados  = productos.filter(function (p) { return p.stock <= 0; });

      /* Cambios recientes: cuántas filas de la tabla `auditoria` (ver
         [[historial]] de admin.js) quedaron en las últimas 24h. La API
         devuelve como máximo 50 (el límite por defecto del backend), así
         que si hubiera más de 50 cambios en un solo día el número real
         quedaría subestimado — poco probable para el volumen de esta
         tienda, pero queda anotado por si algún día hace falta paginar. */
      var haceUnDia = Date.now() - 24 * 60 * 60 * 1000;
      var cambiosRecientes = historial.filter(function (h) {
        return new Date(h.fecha).getTime() >= haceUnDia;
      });

      // Todas las tarjetas son clickeables ahora: cada una manda a la
      // sección del panel donde vive ese dato ("section"), y las de stock
      // además activan su propio filtro antes de entrar a Productos
      // (stockFiltro) — igual que ya hacían.
      var cards = [
        { icon: '🍬', value: productos.length, label: 'Productos', section: 'productos' },
        { icon: '📦', value: confirmados,       label: 'Pedidos confirmados', section: 'pedidos' },
        { icon: '⏳', value: inconclusos,       label: 'Pedidos inconclusos', section: 'pedidos' },
        { icon: '👥', value: clientes.length,   label: 'Clientes', section: 'usuarios' },
        { icon: '💰', value: fmt(revenue),      label: 'Ingresos totales', section: 'pedidos', raw: true },
        // Antes era una sola tarjeta "Stock bajo / agotado" combinada —
        // separadas para que se vea de un vistazo cuál de las dos cosas
        // está pasando, sin tener que entrar a Productos a averiguarlo.
        { icon: '📉', value: bajoStock.length, label: 'Stock bajo', section: 'productos', stockFiltro: 'bajo' },
        { icon: '🚫', value: agotados.length,  label: 'Agotado',    section: 'productos', stockFiltro: 'agotado' },
        { icon: '📜', value: cambiosRecientes.length, label: 'Cambios recientes (24h)', section: 'historial' },
      ];

      var wrap = document.getElementById('stat-cards');
      wrap.innerHTML = '';
      cards.forEach(function (c) {
        var div = document.createElement('div');
        div.className = 'stat-card clickable';
        div.innerHTML =
          '<span class="stat-icon">' + c.icon + '</span>' +
          '<span class="stat-value">' + c.value + '</span>' +
          '<span class="stat-label">' + c.label + '</span>';
        div.addEventListener('click', function () {
          if (c.stockFiltro) {
            // Cada tarjeta activa SOLO su propio filtro (antes las dos
            // se activaban juntas porque era una sola tarjeta combinada).
            _stockFiltroActivo   = c.stockFiltro === 'bajo';
            _agotadoFiltroActivo = c.stockFiltro === 'agotado';
            document.getElementById('btn-filter-stock').classList.toggle('active', _stockFiltroActivo);
            document.getElementById('btn-filter-agotado').classList.toggle('active', _agotadoFiltroActivo);
          }
          document.querySelector('.admin-nav-btn[data-section="' + c.section + '"]').click();
        });
        wrap.appendChild(div);
      });

      /* Lista de alerta de inventario en el dashboard */
      var dashStock = document.getElementById('dash-stock');
      var alerta = agotados.concat(bajoStock).slice(0, 6);
      if (!alerta.length) {
        dashStock.innerHTML = '<p style="color:var(--text-light);font-size:0.88rem;">Todo el inventario está en buen nivel.</p>';
      } else {
        dashStock.innerHTML = alerta.map(function (p) {
          var badge = p.stock <= 0
            ? '<span class="stock-badge agotado">Agotado</span>'
            : '<span class="stock-badge bajo">Bajo (' + p.stock + ')</span>';
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0;border-bottom:1px solid #f3eeff;font-size:0.85rem;">' +
            '<span>' + escapeHtml(p.nombre) + '</span>' + badge +
            '</div>';
        }).join('');
      }

      /* últimos 5 pedidos */
      var dashOrders = document.getElementById('dash-orders');
      var ultimos = pedidos.filter(function (o) { return o.estado !== 'pendiente_finalizar'; }).slice(0, 5);
      if (!ultimos.length) {
        dashOrders.innerHTML = '<p style="color:var(--text-light);font-size:0.88rem;">Sin pedidos aún.</p>';
      } else {
        dashOrders.innerHTML = ultimos.map(function (o) {
          return '<div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid #f3eeff;font-size:0.85rem;">' +
            '<span><strong>#' + o.id + '</strong> — ' + escapeHtml(o.cliente_nombre || '—') + '</span>' +
            '<span style="color:var(--pink);font-weight:700;">' + fmt(calcTotalPedido(o)) + '</span>' +
            '</div>';
        }).join('');
      }

      /* últimos 5 clientes */
      var dashUsers = document.getElementById('dash-users');
      if (!clientes.length) {
        dashUsers.innerHTML = '<p style="color:var(--text-light);font-size:0.88rem;">Sin clientes registrados.</p>';
      } else {
        dashUsers.innerHTML = clientes.slice(0, 5).map(function (u) {
          return '<div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid #f3eeff;font-size:0.85rem;">' +
            '<span>' + escapeHtml(u.nombre) + '</span>' +
            '<span style="color:var(--text-light);">' + escapeHtml(u.email) + '</span>' +
            '</div>';
        }).join('');
      }

      renderAvisosStock(); // aparte: si falla, no debe tumbar el resto del dashboard
    } catch (e) {
      console.error('Dashboard error:', e);
    }
  }

  /* Ícono según origen del aviso — para que se distinga de un vistazo
     si lo detectó el sistema solo o si vino de un cliente pidiendo que
     le avisen al dueño (el tipo, bajo/agotado, ya lo dice la tarjeta
     en la que aparece — ver renderAvisosStock). */
  var AVISO_ORIGEN_ICON = { sistema: '🔔', cliente: '🙋' };

  /* Pinta una lista de avisos (ya filtrados por tipo) dentro de un
     contenedor. Separado en su propia función porque ahora hay dos
     tarjetas — bajo y agotado — que comparten exactamente el mismo
     formato de fila. */
  function _renderAvisosLista(wrap, avisos) {
    if (!avisos.length) {
      wrap.innerHTML = '<p style="color:var(--text-light);font-size:0.88rem;">Sin avisos recientes.</p>';
      return;
    }
    wrap.innerHTML = avisos.slice(0, 6).map(function (a) {
      var icon = AVISO_ORIGEN_ICON[a.origen] || '🔔';
      var detalle = a.origen === 'cliente'
        ? 'Cliente avisó' + (a.cliente_nombre ? ' (' + escapeHtml(a.cliente_nombre) + ')' : '') + (a.pedido_id ? ' · pedido #' + a.pedido_id : '')
        : 'Detectado automáticamente';
      return '<div style="padding:0.4rem 0;border-bottom:1px solid #f3eeff;font-size:0.85rem;">' +
        '<div style="display:flex;justify-content:space-between;">' +
          '<span>' + icon + ' ' + escapeHtml(a.producto_nombre || 'Producto eliminado') + '</span>' +
          '<span style="color:var(--text-light);font-size:0.78rem;">' + fmtFechaCorta(a.fecha) + '</span>' +
        '</div>' +
        '<div style="color:var(--text-light);font-size:0.78rem;">' + detalle + '</div>' +
      '</div>';
    }).join('');
  }

  /* Avisos de stock recientes (widgets del dashboard), separados en
     "bajo" y "agotado" — antes era una sola lista mezclada. Aparte de
     renderDashboard() para que un fallo aquí (ej. instalación vieja
     sin la tabla avisos_stock todavía) no tumbe el resto del panel. */
  async function renderAvisosStock() {
    var wrapBajo    = document.getElementById('dash-avisos-bajo');
    var wrapAgotado = document.getElementById('dash-avisos-agotado');
    if (!wrapBajo || !wrapAgotado) return;
    try {
      var avisos = await apiGetAvisosStock();
      _renderAvisosLista(wrapBajo,    avisos.filter(function (a) { return a.tipo === 'bajo'; }));
      _renderAvisosLista(wrapAgotado, avisos.filter(function (a) { return a.tipo === 'agotado'; }));
    } catch (e) {
      wrapBajo.innerHTML    = '<p style="color:var(--text-light);font-size:0.88rem;">Sin avisos recientes.</p>';
      wrapAgotado.innerHTML = '<p style="color:var(--text-light);font-size:0.88rem;">Sin avisos recientes.</p>';
    }
  }

  /* Dashboard: tarjetas de abajo (Últimos pedidos, Últimos registros,
     Stock bajo o agotado, Avisos) clickeables — mismo espíritu que las
     tarjetas de arriba (#stat-cards, ver renderDashboard): un clic en
     cualquier parte de la tarjeta manda a la sección que diga su
     data-goto-section, y si trae data-goto-stock-filtro también activa
     ese filtro antes de entrar a Productos. Se registra UNA sola vez
     aquí (los <div> son fijos en admin.html, no se recrean en cada
     render, a diferencia de #stat-cards). */
  document.querySelectorAll('.dash-card-clickable').forEach(function (card) {
    card.addEventListener('click', function () {
      var filtro = card.dataset.gotoStockFiltro;
      if (filtro) {
        _stockFiltroActivo   = filtro === 'bajo';
        _agotadoFiltroActivo = filtro === 'agotado';
        document.getElementById('btn-filter-stock').classList.toggle('active', _stockFiltroActivo);
        document.getElementById('btn-filter-agotado').classList.toggle('active', _agotadoFiltroActivo);
      }
      document.querySelector('.admin-nav-btn[data-section="' + card.dataset.gotoSection + '"]').click();
    });
  });

  /* Formato corto de fecha para el widget de avisos: "8 ago" */
  function fmtFechaCorta(str) {
    if (!str) return '';
    return new Date(str).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  /* ══════════════════════════════════════
     PRODUCTOS
  ══════════════════════════════════════ */
  var prodSearchInput  = document.getElementById('prod-search');
  var prodFilterCat    = document.getElementById('prod-filter-cat');
  var btnFilterStock   = document.getElementById('btn-filter-stock');
  var btnFilterAgotado = document.getElementById('btn-filter-agotado');

  prodSearchInput.addEventListener('input', renderProductos);
  prodFilterCat.addEventListener('change', renderProductos);

  /* Dos filtros independientes (antes "Solo bajo stock" también incluía
     los agotados, mezclando ambos grupos en un solo botón):
       - _stockFiltroActivo:   stock > 0 y <= stock_minimo (bajo, pero no agotado)
       - _agotadoFiltroActivo: stock <= 0 (agotado)
     Cada uno se activa/desactiva por su cuenta. Si se activan los dos a
     la vez, se muestran ambos grupos juntos (igual que la tarjeta del
     dashboard, que los cuenta juntos). */
  var _stockFiltroActivo   = false;
  var _agotadoFiltroActivo = false;
  btnFilterStock.addEventListener('click', function () {
    _stockFiltroActivo = !_stockFiltroActivo;
    btnFilterStock.classList.toggle('active', _stockFiltroActivo);
    renderProductos();
  });
  btnFilterAgotado.addEventListener('click', function () {
    _agotadoFiltroActivo = !_agotadoFiltroActivo;
    btnFilterAgotado.classList.toggle('active', _agotadoFiltroActivo);
    renderProductos();
  });

  var _allProductos  = [];
  var _allCategorias = [];

  /* Rellena un <select> con las categorías */
  function _populateCatSelect(sel, selectedValue) {
    var prev = selectedValue !== undefined ? selectedValue : sel.value;
    sel.innerHTML = '<option value="">Todas las categorías</option>';
    _allCategorias.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.nombre;
      opt.textContent = c.nombre.charAt(0).toUpperCase() + c.nombre.slice(1);
      if (c.nombre === prev) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function _populatePfCatSelect(selectedValue) {
    var sel = document.getElementById('pf-cat');
    var prev = selectedValue !== undefined ? selectedValue : sel.value;
    sel.innerHTML = '<option value="">Selecciona categoría</option>';
    _allCategorias.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.nombre;
      opt.textContent = c.nombre.charAt(0).toUpperCase() + c.nombre.slice(1);
      if (c.nombre === prev) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  async function loadCategorias() {
    try {
      _allCategorias = await apiGetCategorias();
      _populateCatSelect(prodFilterCat);
      _populatePfCatSelect();
    } catch (e) {
      console.warn('Error cargando categorías:', e);
    }
  }

  async function renderProductos() {
    try {
      if (!_allCategorias.length) await loadCategorias();
      if (!_allProductos.length)  _allProductos = await apiGetProductos();

      var query   = prodSearchInput.value.trim().toLowerCase();
      var catFilt = prodFilterCat.value;

      var rows = _allProductos.filter(function (p) {
        var matchQ     = !query   || p.nombre.toLowerCase().includes(query);
        var matchCat   = !catFilt || p.categoria === catFilt;
        var esBajo    = p.stock > 0 && p.stock <= p.stock_minimo;
        var esAgotado = p.stock <= 0;
        // Sin filtros de stock activos: no se filtra por stock. Con uno o
        // ambos activos: coincide si cae en cualquiera de los grupos activos.
        var matchStock = (!_stockFiltroActivo && !_agotadoFiltroActivo) ||
          (_stockFiltroActivo && esBajo) || (_agotadoFiltroActivo && esAgotado);
        return matchQ && matchCat && matchStock;
      });

      var tbody = document.getElementById('prod-tbody');
      tbody.innerHTML = '';

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-light);">Sin resultados.</td></tr>';
        document.getElementById('prod-count').textContent = '';
        return;
      }

      rows.forEach(function (p) {
        var tr = document.createElement('tr');
        /* data-label en cada <td>: no hace nada en escritorio (el
           <thead> ya rotula), pero en móvil el CSS oculta el <thead>
           y convierte cada fila en tarjeta usando esta etiqueta —
           ver el bloque "Tablas del panel admin" en admin.css. */
        tr.innerHTML =
          '<td data-label=""><img src="' + escapeHtml(p.imagen || '') + '" alt="' + escapeHtml(p.nombre) + '" style="width:48px;height:48px;object-fit:cover;border-radius:8px;" onerror="this.style.opacity=0.3"></td>' +
          '<td data-label="Nombre"><strong>' + escapeHtml(p.nombre) + '</strong></td>' +
          '<td data-label="Categoría"><span class="admin-badge">' + escapeHtml(p.categoria) + '</span></td>' +
          '<td data-label="Precio"><strong>' + fmt(p.precio) + '</strong></td>' +
          '<td data-label="Stock">' + _stockCellHtml(p) + '</td>' +
          '<td data-label="Destacado"><button class="btn-star-toggle" data-id="' + p.id + '" title="' +
            (p.destacado ? 'Quitar de destacados' : 'Marcar como destacado') +
            '" style="background:none;border:none;cursor:pointer;font-size:1.15rem;line-height:1;padding:0.2rem;">' +
            (p.destacado ? '⭐' : '☆') + '</button></td>' +
          '<td data-label=""><div class="td-actions">' +
            '<button class="btn-admin-sm btn-edit"   data-id="' + p.id + '">✏️ Editar</button>' +
            '<button class="btn-admin-sm btn-delete" data-id="' + p.id + '">🗑️ Eliminar</button>' +
          '</div></td>';
        tbody.appendChild(tr);
      });

      document.getElementById('prod-count').textContent = rows.length + ' producto(s) mostrado(s)';

      tbody.querySelectorAll('.btn-edit').forEach(function (btn) {
        btn.addEventListener('click', function () { openProdModal(+btn.dataset.id); });
      });
      tbody.querySelectorAll('.btn-delete').forEach(function (btn) {
        btn.addEventListener('click', function () { askDelete(+btn.dataset.id); });
      });
      tbody.querySelectorAll('.stock-adjust button').forEach(function (btn) {
        btn.addEventListener('click', function () { ajustarStockRapido(+btn.dataset.id, +btn.dataset.delta); });
      });
      tbody.querySelectorAll('.stock-manual-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var input = tbody.querySelector('.stock-manual-input[data-id="' + btn.dataset.id + '"]');
          _ajustarStockManual(+btn.dataset.id, input);
        });
      });
      tbody.querySelectorAll('.stock-manual-input').forEach(function (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); _ajustarStockManual(+input.dataset.id, input); }
        });
      });

      // Estrella clicable en la columna "Dest.": alterna destacado sin
      // tener que abrir el modal de edición completo.
      tbody.querySelectorAll('.btn-star-toggle').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id  = +btn.dataset.id;
          var idx = _allProductos.findIndex(function (p) { return p.id === id; });
          if (idx === -1) return;
          var nuevoValor = !_allProductos[idx].destacado;
          try {
            var updated = await apiToggleDestacado(id, nuevoValor);
            _allProductos[idx] = updated;
            renderProductos();
          } catch (e) {
            showToast(e.message);
          }
        });
      });
    } catch (e) {
      console.error('Productos error:', e);
    }
  }

  /* Celda de la columna Stock: número + badge de color + botones +/-
     para ajustar rápido sin abrir el modal completo. */
  function _stockCellHtml(p) {
    var badge = p.stock <= 0
      ? '<span class="stock-badge agotado">Agotado</span>'
      : p.stock <= p.stock_minimo
        ? '<span class="stock-badge bajo">Bajo</span>'
        : '<span class="stock-badge ok">' + p.stock + '</span>';
    return '<div class="stock-cell">' +
      '<div class="stock-cell-top">' +
        (p.stock <= 0 || p.stock <= p.stock_minimo ? '<strong>' + p.stock + '</strong> ' : '') + badge +
      '</div>' +
      '<div class="stock-adjust">' +
        '<button data-id="' + p.id + '" data-delta="-1" title="Quitar 1">−</button>' +
        '<button data-id="' + p.id + '" data-delta="1"  title="Agregar 1">+</button>' +
        '<button data-id="' + p.id + '" data-delta="10" title="Agregar 10">+10</button>' +
      '</div>' +
      '<div class="stock-manual">' +
        '<input type="number" class="stock-manual-input" data-id="' + p.id + '" placeholder="Cantidad">' +
        '<button class="stock-manual-btn" data-id="' + p.id + '" title="Agregar esta cantidad al stock">Agregar</button>' +
      '</div>' +
    '</div>';
  }

  /* Lee el <input> de cantidad manual y aplica el ajuste.
     Acepta positivos (llegó mercancía) o negativos (mermas/pérdidas). */
  function _ajustarStockManual(id, inputEl) {
    var delta = parseInt(inputEl.value, 10);
    if (!Number.isInteger(delta) || delta === 0) {
      showToast('Escribe una cantidad distinta de 0.');
      return;
    }
    inputEl.value = '';
    ajustarStockRapido(id, delta);
  }

  /* Ajuste rápido de stock desde la tabla (botones +/-). */
  async function ajustarStockRapido(id, delta) {
    try {
      var updated = await apiAjustarStock(id, delta);
      var idx = _allProductos.findIndex(function (p) { return p.id === id; });
      if (idx !== -1) _allProductos[idx] = updated;
      renderProductos();
    } catch (e) {
      showToast(e.message);
    }
  }

  /* ── Modal producto ── */
  var prodModalOverlay = document.getElementById('prod-modal-overlay');
  var prodEditId       = document.getElementById('prod-edit-id');

  function openProdModal(id) {
    document.getElementById('pf-err').textContent = '';
    if (id === null) {
      document.getElementById('prod-modal-title').textContent = '➕ Agregar producto';
      prodEditId.value = '';
      document.getElementById('pf-name').value       = '';
      document.getElementById('pf-price').value      = '';
      document.getElementById('pf-image').value      = '';
      document.getElementById('pf-stock').value      = 20;
      document.getElementById('pf-stock-min').value  = 5;
      document.getElementById('pf-featured').checked = false;
      _populatePfCatSelect('');
    } else {
      var product = _allProductos.find(function (p) { return p.id === id; });
      if (!product) return;
      document.getElementById('prod-modal-title').textContent = '✏️ Editar producto';
      prodEditId.value = id;
      document.getElementById('pf-name').value       = product.nombre;
      document.getElementById('pf-price').value      = product.precio;
      document.getElementById('pf-image').value      = product.imagen || '';
      document.getElementById('pf-stock').value      = product.stock;
      document.getElementById('pf-stock-min').value  = product.stock_minimo;
      document.getElementById('pf-featured').checked = !!product.destacado;
      _populatePfCatSelect(product.categoria);
    }
    prodModalOverlay.classList.add('open');
  }

  function closeProdModal() { prodModalOverlay.classList.remove('open'); }

  document.getElementById('btn-add-prod').addEventListener('click',      function () { openProdModal(null); });
  document.getElementById('prod-modal-close').addEventListener('click',  closeProdModal);
  document.getElementById('prod-modal-cancel').addEventListener('click', closeProdModal);
  prodModalOverlay.addEventListener('click', function (e) { if (e.target === prodModalOverlay) closeProdModal(); });

  document.getElementById('prod-modal-save').addEventListener('click', async function () {
    var nombre      = document.getElementById('pf-name').value.trim();
    var precio      = parseFloat(document.getElementById('pf-price').value);
    var categoria   = document.getElementById('pf-cat').value;
    var imagen      = document.getElementById('pf-image').value.trim();
    var stock       = parseInt(document.getElementById('pf-stock').value, 10);
    var stockMinimo = parseInt(document.getElementById('pf-stock-min').value, 10);
    var destacado   = document.getElementById('pf-featured').checked;
    var errEl       = document.getElementById('pf-err');
    var editId      = prodEditId.value ? +prodEditId.value : null;

    if (!nombre)               { errEl.textContent = 'El nombre es obligatorio.'; return; }
    if (!precio || precio <= 0){ errEl.textContent = 'El precio debe ser mayor a 0.'; return; }
    if (!categoria)            { errEl.textContent = 'Selecciona una categoría.'; return; }
    if (isNaN(stock) || stock < 0)          { errEl.textContent = 'El stock no puede ser negativo.'; return; }
    if (isNaN(stockMinimo) || stockMinimo < 0) { errEl.textContent = 'La alerta de stock bajo no puede ser negativa.'; return; }
    errEl.textContent = '';

    var datos = { nombre, categoria, precio, imagen, destacado, stock: stock, stock_minimo: stockMinimo };

    try {
      if (editId !== null) {
        var updated = await apiEditarProducto(editId, datos);
        var idx = _allProductos.findIndex(function (p) { return p.id === editId; });
        if (idx !== -1) _allProductos[idx] = updated;
        showToast('Producto actualizado ✓');
      } else {
        var created = await apiCrearProducto(datos);
        _allProductos.push(created);
        showToast('Producto agregado ✓');
      }
      closeProdModal();
      renderProductos();
    } catch (e) {
      errEl.textContent = e.message;
    }
  });

  /* ── Confirmar eliminar ── */
  var _deleteTargetId = null;
  var confirmDialog   = document.getElementById('confirm-dialog');

  function askDelete(id) {
    _deleteTargetId = id;
    confirmDialog.classList.add('open');
  }

  document.getElementById('confirm-no').addEventListener('click', function () {
    confirmDialog.classList.remove('open');
    _deleteTargetId = null;
  });

  document.getElementById('confirm-yes').addEventListener('click', async function () {
    if (_deleteTargetId === null) return;
    try {
      await apiEliminarProducto(_deleteTargetId);
      _allProductos = _allProductos.filter(function (p) { return p.id !== _deleteTargetId; });
      confirmDialog.classList.remove('open');
      _deleteTargetId = null;
      renderProductos();
      showToast('Producto eliminado');
    } catch (e) {
      await dcAlert('Error: ' + e.message);
    }
  });

  /* ══════════════════════════════════════
     PEDIDOS
  ══════════════════════════════════════ */
  document.getElementById('ord-search').addEventListener('input', renderPedidos);

  var ESTADO_LABELS = {
    pendiente_finalizar: { text: 'Pendiente por finalizar', color: '#f59e0b' },
    pendiente_entregar:  { text: 'Pendiente por entregar',  color: '#8b5cf6' },
    entregado:           { text: 'Entregado',               color: '#10b981' },
    cancelado:           { text: 'Cancelado',               color: '#ef4444' },
  };

  async function renderPedidos() {
    var query = document.getElementById('ord-search').value.trim().toLowerCase();
    var tbody = document.getElementById('ord-tbody');
    var empty = document.getElementById('ord-empty');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:1rem;color:var(--text-light);">Cargando…</td></tr>';

    try {
      var pedidos = await apiGetTodosPedidos();

      if (query) pedidos = pedidos.filter(function (o) {
        return String(o.id).includes(query) ||
               (o.cliente_nombre || '').toLowerCase().includes(query) ||
               (o.estado         || '').toLowerCase().includes(query);
      });

      tbody.innerHTML = '';
      if (!pedidos.length) { empty.classList.remove('hidden'); return; }
      empty.classList.add('hidden');

      var pagoLabel = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', transferencia: '🏦 SPEI' };

      pedidos.forEach(function (o) {
        var estadoInfo = ESTADO_LABELS[o.estado] || { text: o.estado, color: '#999' };
        var badge = '<span style="background:' + estadoInfo.color + '20;color:' + estadoInfo.color + ';padding:2px 8px;border-radius:50px;font-size:0.78rem;font-weight:700;">' + estadoInfo.text + '</span>';

        /* selector de estado. data-prev guarda el valor actual para
           poder regresarlo si se cancela el pedido y el admin se
           arrepiente en el diálogo del motivo (ver abajo). */
        var select = '<select class="ord-estado-select" data-id="' + o.id + '" data-prev="' + o.estado + '" style="font-size:0.8rem;padding:3px 6px;border-radius:6px;border:1px solid #ddd;">';
        Object.keys(ESTADO_LABELS).forEach(function (est) {
          select += '<option value="' + est + '"' + (o.estado === est ? ' selected' : '') + '>' + ESTADO_LABELS[est].text + '</option>';
        });
        select += '</select>';

        /* fila principal */
        var tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        /* data-label: ver nota en renderProductos() más arriba —
           mismo mecanismo, lo usa el CSS para la vista de tarjeta
           en móvil. */
        tr.innerHTML =
          '<td data-label="Pedido"><strong>#' + o.id + '</strong></td>' +
          '<td data-label="Cliente">' + escapeHtml(o.cliente_nombre || '—') + '<br><small style="color:var(--text-light);">' + escapeHtml(o.cliente_email || '') + '</small></td>' +
          '<td data-label="Fecha" style="white-space:nowrap;">' + (o.fecha ? new Date(o.fecha).toLocaleDateString('es-MX') : '—') + '</td>' +
          '<td data-label="Estado">' + badge + '<br>' + select + '</td>' +
          '<td data-label="Pago">' + (pagoLabel[o.metodo_pago] || o.metodo_pago || '—') + '</td>' +
          '<td data-label="Total"><strong style="color:var(--pink);">' + fmt(calcTotalPedido(o)) + '</strong></td>' +
          '<td data-label="" style="text-align:center;">▼</td>';

        /* fila de detalle (oculta por defecto) */
        var trDetail = document.createElement('tr');
        trDetail.style.display = 'none';
        var items = o.items || [];
        var itemsHtml = items.length
          ? items.map(function (i) {
              var precio = parseFloat(i.precio || i.price || 0);
              var qty    = i.cantidad || i.qty || 1;
              return '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:0.83rem;border-bottom:1px solid var(--border);color:var(--text);">' +
                '<span>' + escapeHtml(i.nombre || i.name || '—') + ' <span style="color:var(--text-light);">x' + qty + '</span></span>' +
                '<span style="font-weight:700;">' + fmt(precio * qty) + '</span>' +
              '</div>';
            }).join('')
          : '<p style="color:var(--text-light);font-size:0.83rem;">Sin productos registrados.</p>';

        trDetail.innerHTML =
          // background/color con variables: antes era #faf7ff fijo, que en modo
          // oscuro dejaba texto claro sobre fondo claro y se volvía ilegible.
          '<td colspan="7" style="background:var(--bg);color:var(--text);padding:0.8rem 1.2rem;">' +
            (o.estado === 'cancelado'
              ? '<div style="font-size:0.8rem;color:#b91c1c;margin-bottom:0.6rem;">✕ Cancelado por <strong>' +
                  (o.cancelado_por === 'cliente' ? 'el cliente' : 'la tienda') + '</strong>' +
                  (o.motivo_cancelacion ? ' — ' + escapeHtml(o.motivo_cancelacion) : ' (sin motivo especificado)') +
                '</div>'
              : '') +
            '<div style="font-size:0.78rem;font-weight:700;color:var(--purple);margin-bottom:0.4rem;">🍬 Productos del pedido</div>' +
            itemsHtml +
            (o.nombre_envio ? '<div style="margin-top:0.6rem;font-size:0.8rem;color:var(--text-light);">👤 ' + escapeHtml(o.nombre_envio) + (o.telefono ? ' · +52 ' + escapeHtml(o.telefono) : '') + '</div>' : '') +
          '</td>';

        tr.addEventListener('click', function (e) {
          if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
          var visible = trDetail.style.display !== 'none';
          trDetail.style.display = visible ? 'none' : 'table-row';
          tr.querySelector('td:last-child').textContent = visible ? '▼' : '▲';
        });

        tbody.appendChild(tr);
        tbody.appendChild(trDetail);
      });

      /* Cambiar estado desde la tabla. Si el nuevo estado es "cancelado",
         primero se pide un motivo (opcional para el admin, a diferencia
         del cliente) — se le manda por correo al cliente para que sepa
         por qué (ver PATCH /:id/estado en routes/pedidos.js). */
      tbody.querySelectorAll('.ord-estado-select').forEach(function (sel) {
        sel.addEventListener('change', async function () {
          var nuevoEstado = sel.value;
          var motivo;

          if (nuevoEstado === 'cancelado') {
            motivo = await dcPrompt('¿Por qué se cancela el pedido #' + sel.dataset.id + '? (se le avisa al cliente por correo)', {
              placeholder: 'Opcional — ej: producto agotado, cliente no contestó…',
              okLabel: 'Cancelar pedido',
              cancelLabel: 'No cancelar'
            });
            if (motivo === null) { sel.value = sel.dataset.prev; return; } // se arrepintió
          }

          try {
            await apiCambiarEstadoPedido(+sel.dataset.id, nuevoEstado, motivo);
            sel.dataset.prev = nuevoEstado;
            showToast('Estado actualizado ✓');
            renderPedidos(); // repinta la fila (badge + detalle) con el motivo ya guardado
          } catch (e) {
            sel.value = sel.dataset.prev; // el cambio no se aplicó, no dejamos el <select> mintiendo
            await dcAlert('Error: ' + e.message);
          }
        });
      });

    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#e74c3c;">Error al cargar pedidos: ' + e.message + '</td></tr>';
    }
  }

  /* ══════════════════════════════════════
     USUARIOS
  ══════════════════════════════════════ */
  async function renderUsuarios() {
    var tbody = document.getElementById('usr-tbody');
    var empty = document.getElementById('usr-empty');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1rem;color:var(--text-light);">Cargando…</td></tr>';

    try {
      var usuarios = await apiGetUsuarios();
      tbody.innerHTML = '';

      if (!usuarios.length) { empty.classList.remove('hidden'); return; }
      empty.classList.add('hidden');

      usuarios.forEach(function (u) {
        var tr = document.createElement('tr');
        var rolColor = u.rol === 'admin' ? '#8b5cf6' : '#ec4899';
        /* data-label: ver nota en renderProductos() más arriba. */
        tr.innerHTML =
          '<td data-label="Nombre"><strong>' + escapeHtml(u.nombre) + '</strong></td>' +
          '<td data-label="Correo">' + escapeHtml(u.email) + '</td>' +
          '<td data-label="Rol"><span style="background:' + rolColor + '20;color:' + rolColor + ';padding:2px 10px;border-radius:50px;font-size:0.8rem;font-weight:700;">' + escapeHtml(u.rol) + '</span></td>' +
          '<td data-label="Registro">' + (u.fecha_registro ? new Date(u.fecha_registro).toLocaleDateString('es-MX') : '—') + '</td>' +
          '<td data-label="">' +
            (u.rol !== 'admin'
              ? '<button class="btn-admin-sm btn-edit btn-set-admin" data-uid="' + u.id + '" data-nombre="' + escapeHtml(u.nombre) + '">👑 Hacer admin</button>'
              : '<button class="btn-admin-sm btn-delete btn-unset-admin" data-uid="' + u.id + '" data-nombre="' + escapeHtml(u.nombre) + '">🚫 Quitar admin</button>') +
          '</td>';
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('.btn-set-admin').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('¿Dar permisos de administrador a ' + btn.dataset.nombre + '?')) return;
          try {
            await apiCambiarRolUsuario(+btn.dataset.uid, 'admin');
            showToast(btn.dataset.nombre + ' ahora es administrador ✓');
            renderUsuarios();
          } catch (e) {
            await dcAlert('Error: ' + e.message);
          }
        });
      });

      // Antes no existía forma de revertir "Hacer admin" desde la UI —
      // era una acción de un solo sentido. Este botón usa el mismo
      // endpoint (PATCH /usuarios/:id/rol) pero con rol:'cliente'.
      tbody.querySelectorAll('.btn-unset-admin').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('¿Quitar permisos de administrador a ' + btn.dataset.nombre + '? Pasará a ser cliente normal.')) return;
          try {
            await apiCambiarRolUsuario(+btn.dataset.uid, 'cliente');
            showToast(btn.dataset.nombre + ' ya no es administrador ✓');
            renderUsuarios();
          } catch (e) {
            await dcAlert('Error: ' + e.message);
          }
        });
      });

    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#e74c3c;">Error: ' + e.message + '</td></tr>';
    }
  }

  /* ══════════════════════════════════════
     MODAL CATEGORÍAS
  ══════════════════════════════════════ */
  var catsOverlay = document.getElementById('cats-modal-overlay');

  function resetCatForm() {
    document.getElementById('cat-new-name').value  = '';
    document.getElementById('cat-new-emoji').value = '';
    document.getElementById('cat-new-icon').value  = '🍬';
    document.getElementById('cat-img-file').value  = '';
    document.getElementById('cat-upload-status').textContent = '';
    document.getElementById('cat-upload-status').style.color = 'var(--text-light)';
    document.getElementById('cat-add-err').textContent = '';
    var preview = document.getElementById('cat-new-icon-preview');
    if (preview) { preview.innerHTML = '🍬'; }
  }

  function openCatsModal() {
    resetCatForm();
    catsOverlay.classList.add('open');
    renderCatsList();
  }
  function closeCatsModal() { catsOverlay.classList.remove('open'); }

  document.getElementById('cats-modal-close').addEventListener('click', closeCatsModal);
  catsOverlay.addEventListener('click', function (e) { if (e.target === catsOverlay) closeCatsModal(); });
  document.getElementById('btn-manage-cats').addEventListener('click', openCatsModal);

  async function renderCatsList() {
    var listEl  = document.getElementById('cats-list');
    var errEl   = document.getElementById('cat-add-err');
    errEl.textContent = '';
    listEl.innerHTML  = '<p style="color:var(--text-light);font-size:0.88rem;">Cargando…</p>';
    try {
      _allCategorias = await apiGetCategorias();
      /* Refrescar selectores del filtro y del formulario */
      _populateCatSelect(prodFilterCat);
      _populatePfCatSelect();

      if (!_allCategorias.length) {
        listEl.innerHTML = '<p style="color:var(--text-light);font-size:0.88rem;">Sin categorías.</p>';
        return;
      }
      listEl.innerHTML = '';
      _allCategorias.forEach(function (cat) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-bottom:1px solid #f3eeff;';
        row.innerHTML =
          '<span style="font-size:1.2rem;width:28px;text-align:center;overflow:hidden;border-radius:6px;">' + renderCatIcon(cat.icono || '🍬', '28px') + '</span>' +
          '<span style="flex:1;font-size:0.9rem;font-weight:600;text-transform:capitalize;">' + escapeHtml(cat.nombre) + '</span>' +
          /* Inputs de edición (ocultos por defecto) */
          '<input type="text" data-catid="' + cat.id + '" class="cat-edit-icon" value="' + escapeHtml(cat.icono||'🍬') + '" ' +
            'style="display:none;width:44px;padding:0.3rem 0.4rem;border:1px solid #ddd;border-radius:6px;font-size:1rem;text-align:center;" />' +
          '<input type="text" data-catid="' + cat.id + '" class="cat-edit-input" value="' + escapeHtml(cat.nombre) + '" ' +
            'style="display:none;flex:1;padding:0.3rem 0.6rem;border:1px solid #ddd;border-radius:6px;font-size:0.85rem;" />' +
          '<button class="btn-admin-sm btn-edit   cat-btn-edit"   data-catid="' + cat.id + '">✏️</button>' +
          '<button class="btn-admin-sm btn-edit   cat-btn-save"   data-catid="' + cat.id + '" style="display:none;background:#10b981;color:#fff;">💾</button>' +
          '<button class="btn-admin-sm btn-delete cat-btn-delete" data-catid="' + cat.id + '" data-nombre="' + escapeHtml(cat.nombre) + '">🗑️</button>';
        listEl.appendChild(row);
      });

      /* Editar en línea */
      listEl.querySelectorAll('.cat-btn-edit').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var row2 = btn.closest('div');
          /* ocultar spans de display, mostrar inputs */
          row2.querySelectorAll('span').forEach(function (s) { s.style.display = 'none'; });
          row2.querySelector('.cat-edit-icon').style.display  = '';
          row2.querySelector('.cat-edit-input').style.display = '';
          row2.querySelector('.cat-btn-edit').style.display   = 'none';
          row2.querySelector('.cat-btn-save').style.display   = '';
        });
      });

      listEl.querySelectorAll('.cat-btn-save').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id     = +btn.dataset.catid;
          var row2   = btn.closest('div');
          var nombre = row2.querySelector('.cat-edit-input').value.trim();
          var icono  = row2.querySelector('.cat-edit-icon').value.trim() || '🍬';
          if (!nombre) return;
          try {
            await apiEditarCategoria(id, nombre, icono);
            showToast('Categoría actualizada ✓');
            /* Forzar recarga de productos para reflejar el nuevo nombre */
            _allProductos = [];
            renderCatsList();
          } catch (e) {
            await dcAlert('Error: ' + e.message);
          }
        });
      });

      /* Eliminar */
      listEl.querySelectorAll('.cat-btn-delete').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('¿Eliminar la categoría "' + btn.dataset.nombre + '"?\n(Solo se puede si no tiene productos activos)')) return;
          try {
            await apiEliminarCategoria(+btn.dataset.catid);
            showToast('Categoría eliminada ✓');
            _allProductos = [];
            renderCatsList();
          } catch (e) {
            await dcAlert('Error: ' + e.message);
          }
        });
      });
    } catch (e) {
      listEl.innerHTML = '<p style="color:#e74c3c;font-size:0.88rem;">Error al cargar categorías.</p>';
    }
  }

  /* Agregar nueva categoría */
  /* ── Vista previa cuando se escribe un emoji ── */
  document.getElementById('cat-new-emoji').addEventListener('input', function () {
    var emoji   = this.value.trim() || '🍬';
    var preview = document.getElementById('cat-new-icon-preview');
    var hidden  = document.getElementById('cat-new-icon');
    var status  = document.getElementById('cat-upload-status');
    /* Si hay imagen subida y el usuario empieza a escribir un emoji,
       limpiar la imagen y usar el emoji en su lugar */
    if (this.value.trim()) {
      status.textContent = '';
      document.getElementById('cat-img-file').value = '';
    }
    if (preview) preview.innerHTML = renderCatIcon(emoji, '60px');
    hidden.value = emoji;
  });

  /* ── Subir imagen de categoría ── */
  document.getElementById('cat-img-file').addEventListener('change', async function () {
    var file    = this.files[0];
    if (!file) return;
    var status  = document.getElementById('cat-upload-status');
    var preview = document.getElementById('cat-new-icon-preview');
    var hidden  = document.getElementById('cat-new-icon');
    var emojiIn = document.getElementById('cat-new-emoji');

    status.textContent = 'Subiendo…';
    status.style.color = 'var(--text-light)';
    try {
      var url = await _subirImagen(file, '/api/upload/categoria');
      hidden.value   = url;          // guardar URL en campo oculto
      emojiIn.value  = '';           // limpiar el campo de emoji
      if (preview) preview.innerHTML = renderCatIcon(url, '60px');
      status.textContent = '✅ ' + file.name;
      status.style.color = '#10b981';
    } catch (e) {
      status.textContent = '✗ ' + e.message;
      status.style.color = '#e74c3c';
    }
  });

  /* ── Subir imagen de producto ── */
  document.getElementById('pf-img-file').addEventListener('change', async function () {
    var file   = this.files[0];
    if (!file) return;
    var status = document.getElementById('pf-upload-status');
    status.textContent = 'Subiendo…';
    try {
      var url = await _subirImagen(file, '/api/upload/producto');
      document.getElementById('pf-image').value = url;
      status.textContent = '✅ ' + file.name;
      status.style.color = '#10b981';
    } catch (e) {
      status.textContent = '✗ Error: ' + e.message;
      status.style.color = '#e74c3c';
    }
  });

  document.getElementById('btn-cat-add').addEventListener('click', async function () {
    var input  = document.getElementById('cat-new-name');
    var iconIn = document.getElementById('cat-new-icon');
    var errEl  = document.getElementById('cat-add-err');
    var nombre = input.value.trim();
    var icono  = (iconIn.value.trim()) || '🍬';
    if (!nombre) { errEl.textContent = 'Escribe un nombre.'; return; }
    try {
      await apiCrearCategoria(nombre, icono);
      resetCatForm();
      showToast('Categoría "' + nombre + '" creada ✓');
      renderCatsList();
    } catch (e) {
      errEl.textContent = e.message;
    }
  });
  document.getElementById('cat-new-name').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('btn-cat-add').click();
  });

  /* ══════════════════════════════════════
     PAPELERA (productos con soft-delete, activo=0)
  ══════════════════════════════════════ */
  var trashOverlay = document.getElementById('trash-modal-overlay');

  function openTrashModal() {
    trashOverlay.classList.add('open');
    renderTrashList();
  }
  function closeTrashModal() { trashOverlay.classList.remove('open'); }

  document.getElementById('btn-trash').addEventListener('click', openTrashModal);
  document.getElementById('trash-modal-close').addEventListener('click', closeTrashModal);
  trashOverlay.addEventListener('click', function (e) { if (e.target === trashOverlay) closeTrashModal(); });

  async function renderTrashList() {
    var listEl = document.getElementById('trash-list');
    listEl.innerHTML = '<p style="color:var(--text-light);font-size:0.88rem;">Cargando…</p>';
    try {
      var productos = await apiGetPapelera();
      if (!productos.length) {
        listEl.innerHTML = '<p style="color:var(--text-light);font-size:0.88rem;">La papelera está vacía.</p>';
        return;
      }
      listEl.innerHTML = '';
      productos.forEach(function (p) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-bottom:1px solid #f3eeff;';
        row.innerHTML =
          '<img src="' + escapeHtml(p.imagen || '') + '" alt="' + escapeHtml(p.nombre) + '" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex-shrink:0;" onerror="this.style.opacity=0.3">' +
          '<span style="flex:1;font-size:0.88rem;font-weight:600;">' + escapeHtml(p.nombre) + '</span>' +
          '<button class="btn-admin-sm btn-edit trash-btn-restore" data-id="' + p.id + '">♻️ Restaurar</button>';
        listEl.appendChild(row);
      });
      listEl.querySelectorAll('.trash-btn-restore').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await apiReactivarProducto(+btn.dataset.id);
            showToast('Producto restaurado ✓');
            _allProductos = []; // forzar recarga para que vuelva a aparecer en la tabla
            renderTrashList();
            renderProductos();
          } catch (e) {
            await dcAlert('Error: ' + e.message);
          }
        });
      });
    } catch (e) {
      listEl.innerHTML = '<p style="color:#e74c3c;font-size:0.88rem;">Error al cargar la papelera.</p>';
    }
  }

  /* ══════════════════════════════════════
     CONFIGURACIÓN
  ══════════════════════════════════════ */
  async function renderConfiguracion() {
    var msgEl = document.getElementById('cfg-msg');
    msgEl.textContent = 'Cargando…';
    msgEl.style.color = 'var(--text-light)';
    try {
      var cfg = await apiGetContacto();
      document.getElementById('cfg-direccion').value  = cfg.contacto_direccion  || '';
      document.getElementById('cfg-ciudad').value     = cfg.contacto_ciudad     || '';
      document.getElementById('cfg-horario').value    = cfg.contacto_horario    || '';
      document.getElementById('cfg-telefono').value   = cfg.contacto_telefono   || '';
      document.getElementById('cfg-email').value      = cfg.contacto_email      || '';
      document.getElementById('cfg-whatsapp').value   = cfg.contacto_whatsapp   || '';
      msgEl.textContent = '';
    } catch (e) {
      msgEl.textContent = 'Error al cargar configuración.';
      msgEl.style.color = '#e74c3c';
    }
  }

  document.getElementById('btn-cfg-save').addEventListener('click', async function () {
    var msgEl = document.getElementById('cfg-msg');
    msgEl.textContent = 'Guardando…';
    msgEl.style.color = 'var(--text-light)';
    try {
      await apiGuardarContacto({
        contacto_direccion:  document.getElementById('cfg-direccion').value.trim(),
        contacto_ciudad:     document.getElementById('cfg-ciudad').value.trim(),
        contacto_horario:    document.getElementById('cfg-horario').value.trim(),
        contacto_telefono:   document.getElementById('cfg-telefono').value.trim(),
        contacto_email:      document.getElementById('cfg-email').value.trim(),
        contacto_whatsapp:   document.getElementById('cfg-whatsapp').value.trim(),
      });
      msgEl.textContent = '✅ Cambios guardados correctamente.';
      msgEl.style.color = '#10b981';
      showToast('Configuración guardada ✓');
    } catch (e) {
      msgEl.textContent = 'Error: ' + e.message;
      msgEl.style.color = '#e74c3c';
    }
  });

  /* ══════════════════════════════════════
     CHATBOT: PREGUNTAS FRECUENTES
     Ver backend/routes/chatbot_faq.js y la sección "CHATBOT DEL
     SITIO" en cart.js, que consume estas preguntas en el chatbot
     flotante del sitio.
  ══════════════════════════════════════ */
  var _allFaqs = [];
  var FAQ_ACCION_LABELS = {
    ninguna:  '— Sin acción',
    link:     '🔗 Link',
    whatsapp: '💬 WhatsApp',
    catalogo: '🍬 Catálogo',
    pedidos:  '📦 Mis pedidos'
  };

  /* Vista previa: el botón "🧪 Probar chatbot" inyecta el widget REAL del
     sitio (cart.js) — normalmente no aparece en admin.html — y lo abre ahí
     mismo, para poder probar los cambios sin salir del panel. Después de
     guardar/borrar una pregunta se invalida su caché y se refresca la
     lista de accesos rápidos para que el cambio se vea al instante. */
  function _refreshChatPreview() {
    if (typeof resetChatFaqsCache === 'function') resetChatFaqsCache();
    if (typeof chatRenderQuickReplies === 'function') chatRenderQuickReplies();
  }

  document.getElementById('btn-preview-chatbot').addEventListener('click', function () {
    if (typeof injectWhatsAppBubble === 'function') injectWhatsAppBubble();
    if (typeof injectChatWidget === 'function') injectChatWidget();
    if (typeof openChatPanel === 'function') openChatPanel();
  });

  // Quita la burbuja y el panel del DOM por completo (no solo los cierra) —
  // se usa al salir de la sección Chatbot, ver el click de navBtns arriba.
  function removeChatbotPreview() {
    var bubble = document.getElementById('wa-bubble');
    var panel  = document.getElementById('dc-chat-panel');
    if (bubble) bubble.remove();
    if (panel)  panel.remove();
  }

  async function renderChatbotFaqs() {
    var listEl  = document.getElementById('faq-list');
    var emptyEl = document.getElementById('faq-empty');
    listEl.innerHTML = '<p style="color:var(--text-light);font-size:0.88rem;">Cargando…</p>';
    emptyEl.classList.add('hidden');
    try {
      _allFaqs = await apiGetChatbotFaqsAdmin();
    } catch (e) {
      listEl.innerHTML = '<p style="color:#e74c3c;font-size:0.88rem;">Error al cargar las preguntas.</p>';
      return;
    }

    if (!_allFaqs.length) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    listEl.innerHTML = '';
    _allFaqs.forEach(function (faq) {
      var card = document.createElement('div');
      card.style.cssText =
        'background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);' +
        'padding:1rem 1.2rem;' + (faq.activo ? '' : 'opacity:0.6;');
      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.8rem;flex-wrap:wrap;">' +
          /* overflow-wrap:anywhere — "Palabras clave" es texto libre que
             el admin escribe sin espacio después de cada coma a veces
             (ej: "horario,hora,abren,cierran,..."); sin esto el navegador
             lo trata como una sola palabra gigante y se sale de la
             tarjeta en pantallas angostas en vez de partirse de línea. */
          '<div style="flex:1;min-width:220px;overflow-wrap:anywhere;">' +
            '<div style="font-weight:700;color:var(--text);margin-bottom:0.3rem;">' + escapeHtml(faq.pregunta) + '</div>' +
            '<div style="font-size:0.82rem;color:var(--text-light);margin-bottom:0.4rem;">' + escapeHtml(faq.respuesta).replace(/\n/g, ' · ') + '</div>' +
            (faq.palabras_clave ? '<div style="font-size:0.78rem;color:var(--text-light);"><strong>Palabras clave:</strong> ' + escapeHtml(faq.palabras_clave) + '</div>' : '') +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem;">' +
            '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;justify-content:flex-end;">' +
              '<span class="admin-badge">' + (FAQ_ACCION_LABELS[faq.accion_tipo] || faq.accion_tipo) + '</span>' +
              '<span class="admin-badge' + (faq.activo ? '' : ' featured') + '">' + (faq.activo ? '✅ Activa' : '⏸️ Inactiva') + '</span>' +
            '</div>' +
            '<div class="td-actions">' +
              '<button class="btn-admin-sm btn-edit faq-btn-edit" data-id="' + faq.id + '">✏️ Editar</button>' +
              '<button class="btn-admin-sm btn-delete faq-btn-delete" data-id="' + faq.id + '">🗑️</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      listEl.appendChild(card);
    });

    listEl.querySelectorAll('.faq-btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () { openFaqModal(+btn.dataset.id); });
    });
    listEl.querySelectorAll('.faq-btn-delete').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var faq = _allFaqs.find(function (f) { return f.id === +btn.dataset.id; });
        var ok = await dcConfirm('¿Eliminar la pregunta "' + (faq ? faq.pregunta : '') + '"? Esta acción no se puede deshacer.', 'Sí, eliminar');
        if (!ok) return;
        try {
          await apiEliminarChatbotFaq(+btn.dataset.id);
          showToast('Pregunta eliminada');
          renderChatbotFaqs();
          _refreshChatPreview();
        } catch (e) {
          await dcAlert('Error: ' + e.message);
        }
      });
    });
  }

  var faqModalOverlay = document.getElementById('faq-modal-overlay');
  var faqEditId       = document.getElementById('faq-edit-id');
  var faqAccionTipo   = document.getElementById('faq-accion-tipo');
  var faqAccionExtra  = document.getElementById('faq-accion-extra');

  function _faqToggleAccionExtra() {
    // El link/categoría y el texto del botón solo aplican a link/catálogo
    var tipo = faqAccionTipo.value;
    faqAccionExtra.style.display = (tipo === 'link' || tipo === 'catalogo') ? '' : 'none';
  }
  faqAccionTipo.addEventListener('change', _faqToggleAccionExtra);

  function openFaqModal(id) {
    document.getElementById('faq-err').textContent = '';
    if (id === null) {
      document.getElementById('faq-modal-title').textContent = '➕ Agregar pregunta';
      faqEditId.value = '';
      document.getElementById('faq-pregunta').value      = '';
      document.getElementById('faq-palabras').value      = '';
      document.getElementById('faq-respuesta').value     = '';
      faqAccionTipo.value = 'ninguna';
      document.getElementById('faq-accion-valor').value  = '';
      document.getElementById('faq-accion-texto').value  = '';
      document.getElementById('faq-orden').value         = _allFaqs.length ? Math.max.apply(null, _allFaqs.map(function (f) { return f.orden; })) + 1 : 1;
      document.getElementById('faq-activo').checked      = true;
    } else {
      var faq = _allFaqs.find(function (f) { return f.id === id; });
      if (!faq) return;
      document.getElementById('faq-modal-title').textContent = '✏️ Editar pregunta';
      faqEditId.value = id;
      document.getElementById('faq-pregunta').value      = faq.pregunta;
      document.getElementById('faq-palabras').value      = faq.palabras_clave || '';
      document.getElementById('faq-respuesta').value     = faq.respuesta;
      faqAccionTipo.value = faq.accion_tipo || 'ninguna';
      document.getElementById('faq-accion-valor').value  = faq.accion_valor || '';
      document.getElementById('faq-accion-texto').value  = faq.accion_texto || '';
      document.getElementById('faq-orden').value         = faq.orden || 0;
      document.getElementById('faq-activo').checked      = !!faq.activo;
    }
    _faqToggleAccionExtra();
    faqModalOverlay.classList.add('open');
  }

  function closeFaqModal() { faqModalOverlay.classList.remove('open'); }

  document.getElementById('btn-add-faq').addEventListener('click',   function () { openFaqModal(null); });
  document.getElementById('faq-modal-close').addEventListener('click',  closeFaqModal);
  document.getElementById('faq-modal-cancel').addEventListener('click', closeFaqModal);
  faqModalOverlay.addEventListener('click', function (e) { if (e.target === faqModalOverlay) closeFaqModal(); });

  document.getElementById('faq-modal-save').addEventListener('click', async function () {
    var errEl = document.getElementById('faq-err');
    var datos = {
      pregunta:       document.getElementById('faq-pregunta').value.trim(),
      palabras_clave: document.getElementById('faq-palabras').value.trim(),
      respuesta:      document.getElementById('faq-respuesta').value.trim(),
      accion_tipo:    faqAccionTipo.value,
      accion_valor:   document.getElementById('faq-accion-valor').value.trim(),
      accion_texto:   document.getElementById('faq-accion-texto').value.trim(),
      orden:          parseInt(document.getElementById('faq-orden').value, 10) || 0,
      activo:         document.getElementById('faq-activo').checked
    };
    if (!datos.pregunta)  { errEl.textContent = 'La pregunta es obligatoria.'; return; }
    if (!datos.respuesta) { errEl.textContent = 'La respuesta es obligatoria.'; return; }
    errEl.textContent = '';

    var editId = faqEditId.value ? +faqEditId.value : null;
    try {
      if (editId !== null) {
        await apiEditarChatbotFaq(editId, datos);
        showToast('Pregunta actualizada ✓');
      } else {
        await apiCrearChatbotFaq(datos);
        showToast('Pregunta agregada ✓');
      }
      closeFaqModal();
      renderChatbotFaqs();
      _refreshChatPreview();
    } catch (e) {
      errEl.textContent = e.message;
    }
  });

  /* ══════════════════════════════════════
     AUDITORÍAS
     Lista los reportes HTML de docs/auditorias/ (backend/routes/
     auditorias.js — solo accesible con sesión de admin). "Ver" pide
     el HTML con el token de admin (fetch, no <a href> normal, porque
     un link no puede mandar el header de autorización) y lo abre en
     una pestaña nueva como blob: URL.
  ══════════════════════════════════════ */
  async function renderAuditorias() {
    var listEl  = document.getElementById('auditorias-list');
    var emptyEl = document.getElementById('auditorias-empty');
    listEl.innerHTML = '<p style="color:var(--text-light);font-size:0.88rem;">Cargando…</p>';
    emptyEl.classList.add('hidden');

    var archivos;
    try {
      archivos = await apiGetAuditorias();
    } catch (e) {
      listEl.innerHTML = '<p style="color:#e74c3c;font-size:0.88rem;">Error al cargar las auditorías: ' + e.message + '</p>';
      return;
    }

    if (!archivos.length) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    listEl.innerHTML = '';
    archivos.forEach(function (a) {
      var row = document.createElement('div');
      row.className = 'admin-table-wrap';
      row.style.cssText = 'padding:0.9rem 1.2rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;';
      row.innerHTML =
        '<div>' +
          '<div style="font-weight:700;color:var(--text);">🔍 ' + escapeHtml(a.nombre) + '</div>' +
          '<div style="font-size:0.78rem;color:var(--text-light);">' + fmtFechaCorta(a.fecha) + ' · ' + _fmtTamano(a.tamano) + '</div>' +
        '</div>' +
        '<button class="btn-admin-sm btn-edit btn-ver-auditoria" data-nombre="' + escapeHtml(a.nombre) + '">👁️ Ver</button>';
      listEl.appendChild(row);
    });

    listEl.querySelectorAll('.btn-ver-auditoria').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Abriendo…';
        try {
          var html = await apiGetAuditoriaHtml(btn.dataset.nombre);
          // charset=utf-8 explícito: sin esto el navegador puede adivinar
          // mal la codificación del blob y los acentos salen como "Ã³".
          var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          var url  = URL.createObjectURL(blob);
          window.open(url, '_blank');
          // Revoca el blob más tarde — la pestaña nueva ya lo cargó,
          // no hace falta mantenerlo vivo indefinidamente en memoria.
          setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        } catch (e) {
          showToast('Error al abrir la auditoría: ' + e.message);
        } finally {
          btn.disabled = false;
          btn.textContent = textoOriginal;
        }
      });
    });
  }

  /* ══════════════════════════════════════
     HISTORIAL DE CAMBIOS
     Lee la tabla `auditoria` (backend/routes/historial.js), que se
     llena SOLA con 8 triggers de MySQL — nadie del backend escribe
     ahí a mano. No confundir con renderAuditorias() de arriba (esos
     son los reportes HTML de bugs/seguridad, cosa aparte).
  ══════════════════════════════════════ */
  var histFilterTabla  = document.getElementById('hist-filter-tabla');
  var histFilterAccion = document.getElementById('hist-filter-accion');
  histFilterTabla.addEventListener('change', renderHistorial);
  histFilterAccion.addEventListener('change', renderHistorial);

  var ACCION_LABEL = { INSERT: 'Creado', UPDATE: 'Actualizado', DELETE: 'Eliminado' };
  var ACCION_BADGE = { INSERT: 'ok', UPDATE: 'bajo', DELETE: 'agotado' }; // reutiliza los colores de .stock-badge

  /* Fecha completa con hora — a diferencia de fmtFechaCorta (que
     solo da "8 ago" para las tarjetas del dashboard), aquí sí
     importa saber a qué hora exacta pasó cada cambio. */
  function fmtFechaHora(str) {
    if (!str) return '';
    return new Date(str).toLocaleString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  /* Da formato legible a datos_anteriores/datos_nuevos (vienen como
     JSON desde MySQL, o ya como objeto si mysql2 los parseó solo). */
  function fmtDetalleJson(valor) {
    if (valor === null || valor === undefined) return null;
    try {
      var obj = typeof valor === 'string' ? JSON.parse(valor) : valor;
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(valor);
    }
  }

  async function renderHistorial() {
    var tbody  = document.getElementById('hist-tbody');
    var emptyEl = document.getElementById('hist-empty');
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-light);">Cargando…</td></tr>';
    emptyEl.classList.add('hidden');

    var filas;
    try {
      filas = await apiGetHistorialCambios({
        tabla:  histFilterTabla.value,
        accion: histFilterAccion.value
      });
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:#e74c3c;">Error al cargar el historial: ' + escapeHtml(e.message) + '</td></tr>';
      return;
    }

    if (!filas.length) {
      tbody.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    tbody.innerHTML = '';
    filas.forEach(function (fila) {
      var tr = document.createElement('tr');
      var accionLabel = ACCION_LABEL[fila.accion] || fila.accion;
      var accionBadge = ACCION_BADGE[fila.accion] || 'ok';

      var antes    = fmtDetalleJson(fila.datos_anteriores);
      var despues  = fmtDetalleJson(fila.datos_nuevos);
      var tieneDetalle = antes || despues;

      /* data-label en cada <td>: en escritorio no hace nada (el <thead>
         ya rotula las columnas), pero en móvil el CSS oculta el <thead>
         y usa este atributo para poner la etiqueta junto al valor —
         así la fila se puede apilar en tarjeta en vez de obligar a
         hacer scroll horizontal por 6 columnas (ver admin.css). */
      tr.innerHTML =
        '<td data-label="Fecha" style="white-space:nowrap;">' + fmtFechaHora(fila.fecha) + '</td>' +
        '<td data-label="Tabla" style="text-transform:capitalize;">' + escapeHtml(fila.tabla_afectada) + '</td>' +
        '<td data-label="Acción"><span class="stock-badge ' + accionBadge + '">' + accionLabel + '</span></td>' +
        '<td data-label="Descripción">' + escapeHtml(fila.descripcion || '') + '</td>' +
        '<td data-label="Quién">' + escapeHtml(fila.usuario || 'sistema') + '</td>' +
        '<td data-label="">' + (tieneDetalle ? '<button class="btn-admin-sm btn-edit btn-ver-detalle">👁️ Ver</button>' : '') + '</td>';
      tbody.appendChild(tr);

      if (tieneDetalle) {
        var trDetalle = document.createElement('tr');
        trDetalle.className = 'hidden';
        var bloques = '';
        if (antes)   bloques += '<div><div style="font-weight:700;font-size:0.78rem;color:var(--text-light);margin-bottom:0.2rem;">Antes</div><pre style="background:var(--bg-2,rgba(0,0,0,0.04));padding:0.6rem 0.8rem;border-radius:8px;font-size:0.76rem;overflow-x:auto;white-space:pre-wrap;">' + escapeHtml(antes) + '</pre></div>';
        if (despues) bloques += '<div><div style="font-weight:700;font-size:0.78rem;color:var(--text-light);margin-bottom:0.2rem;">Después</div><pre style="background:var(--bg-2,rgba(0,0,0,0.04));padding:0.6rem 0.8rem;border-radius:8px;font-size:0.76rem;overflow-x:auto;white-space:pre-wrap;">' + escapeHtml(despues) + '</pre></div>';
        trDetalle.innerHTML = '<td colspan="6"><div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;max-width:700px;">' + bloques + '</div></td>';
        tbody.appendChild(trDetalle);

        tr.querySelector('.btn-ver-detalle').addEventListener('click', function () {
          trDetalle.classList.toggle('hidden');
        });
      }
    });
  }

  /* ══════════════════════════════════════
     RESPALDOS
     Botón para generar un respaldo de la BD ahora mismo (backend/
     routes/respaldos.js), sin esperar al Cron Job diario. El botón
     es fijo en el HTML (no se recrea cada vez que se entra a la
     sección), así que su listener se registra UNA sola vez aquí
     abajo — renderRespaldos() solo actualiza los textos.
  ══════════════════════════════════════ */
  async function renderRespaldos() {
    var infoEl = document.getElementById('respaldo-info');
    infoEl.textContent = 'Cargando…';
    try {
      var data = await apiGetRespaldoInfo();
      infoEl.textContent = data.ultimo
        ? data.ultimo.nombre + ' — ' + data.ultimo.tamanoMB + ' MB — ' + fmtFechaCorta(data.ultimo.fecha)
        : 'Todavía no se ha generado ningún respaldo en este servidor.';
    } catch (e) {
      infoEl.textContent = 'Error al consultar el estado: ' + e.message;
    }
  }

  var btnGenerarRespaldo = document.getElementById('btn-generar-respaldo');
  if (btnGenerarRespaldo) {
    btnGenerarRespaldo.addEventListener('click', async function () {
      var resultadoEl = document.getElementById('respaldo-resultado');
      var textoOriginal = btnGenerarRespaldo.textContent;
      btnGenerarRespaldo.disabled = true;
      btnGenerarRespaldo.textContent = 'Generando… (puede tardar un momento)';
      resultadoEl.textContent = '';
      resultadoEl.style.color = '';
      try {
        var r = await apiGenerarRespaldo();
        if (r.mailed) {
          resultadoEl.style.color = 'var(--teal)';
          resultadoEl.textContent = '✅ Respaldo generado (' + r.tamanoMB + ' MB) y enviado por correo a ' + r.destino + '.';
        } else {
          resultadoEl.style.color = '#c9821a';
          resultadoEl.textContent = '⚠️ Respaldo local generado (' + r.tamanoMB + ' MB), pero no se mandó por correo: ' + r.motivo;
        }
        renderRespaldos(); // refresca "último respaldo" con el que se acaba de generar
      } catch (e) {
        resultadoEl.style.color = '#e74c3c';
        resultadoEl.textContent = '❌ ' + e.message;
      } finally {
        btnGenerarRespaldo.disabled = false;
        btnGenerarRespaldo.textContent = textoOriginal;
      }
    });
  }

  /* Tamaño de archivo legible: 5241 → "5.1 KB" */
  function _fmtTamano(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /* ══ Subir imagen al servidor ══
     Usa FormData para enviar el archivo como multipart/form-data.
     El token JWT se agrega manualmente porque apiFetch solo maneja JSON. */
  async function _subirImagen(file, endpoint) {
    var formData = new FormData();
    formData.append('imagen', file);

    var token = localStorage.getItem('dc_token') || sessionStorage.getItem('dc_token') || '';
    var res   = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
      /* NO ponemos Content-Type: el navegador lo pone solo con el boundary correcto */
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Error al subir imagen');
    return data.url; // devuelve "img/categorias/nombre.jpg"
  }

  /* Toast: se usa la función global showToast() de js/cart.js (que ya
     se carga antes que admin.js en admin.html) — antes había una
     segunda implementación local aquí, con estilo distinto, que
     ocultaba a la global dentro de este archivo sin motivo. */

  /* ══ Init ══ */
  loadCategorias();
  renderDashboard();
});
