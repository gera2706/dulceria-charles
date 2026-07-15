/* ============================================================
   ADMIN PANEL JS — Dulcería Charles  (API version)
============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  function fmt(n) { return '$' + (isNaN(n) ? '0' : Number.isInteger(+n) ? +n : parseFloat(n).toFixed(2)); }

  /* Calcula el total de un pedido. Si el campo total es 0 (datos viejos),
     lo suma desde los items para mostrarlo correctamente. */
  function _calcTotal(o) {
    var t = parseFloat(o.total || 0);
    if (!t && o.items && o.items.length) {
      t = o.items.reduce(function (s, i) {
        return s + parseFloat(i.precio || i.price || 0) * (i.cantidad || i.qty || 1);
      }, 0);
    }
    return t;
  }

  /* ══ Navegación lateral ══ */
  var navBtns = document.querySelectorAll('.admin-nav-btn');
  navBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      navBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(function (s) { s.classList.remove('active'); });
      document.getElementById('sec-' + btn.dataset.section).classList.add('active');
      if (btn.dataset.section === 'dashboard')     renderDashboard();
      if (btn.dataset.section === 'productos')     renderProductos();
      if (btn.dataset.section === 'pedidos')       renderPedidos();
      if (btn.dataset.section === 'usuarios')      renderUsuarios();
      if (btn.dataset.section === 'configuracion') renderConfiguracion();
    });
  });

  /* ══════════════════════════════════════
     DASHBOARD
  ══════════════════════════════════════ */
  async function renderDashboard() {
    try {
      var [productos, pedidos, usuarios] = await Promise.all([
        apiGetProductos(),
        apiGetTodosPedidos(),
        apiGetUsuarios()
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
        .reduce(function (s, o) { return s + _calcTotal(o); }, 0);

      /* Stock bajo: tiene existencias pero ya llegó (o pasó) su umbral de alerta.
         Agotado: no queda ni una pieza. Ambos casos van en la misma tarjeta
         de alerta para que el admin los vea de un vistazo. */
      var bajoStock = productos.filter(function (p) { return p.stock > 0 && p.stock <= p.stock_minimo; });
      var agotados  = productos.filter(function (p) { return p.stock <= 0; });

      var cards = [
        { icon: '🍬', value: productos.length, label: 'Productos' },
        { icon: '📦', value: confirmados,       label: 'Pedidos confirmados' },
        { icon: '⏳', value: inconclusos,       label: 'Pedidos inconclusos' },
        { icon: '👥', value: clientes.length,   label: 'Clientes' },
        { icon: '💰', value: fmt(revenue),      label: 'Ingresos totales', raw: true },
        { icon: '⚠️', value: bajoStock.length + agotados.length, label: 'Stock bajo / agotado', click: true },
      ];

      var wrap = document.getElementById('stat-cards');
      wrap.innerHTML = '';
      cards.forEach(function (c) {
        var div = document.createElement('div');
        div.className = 'stat-card' + (c.click ? ' clickable' : '');
        div.innerHTML =
          '<span class="stat-icon">' + c.icon + '</span>' +
          '<span class="stat-value">' + c.value + '</span>' +
          '<span class="stat-label">' + c.label + '</span>';
        if (c.click) {
          div.addEventListener('click', function () {
            _stockFiltroActivo = true;
            document.getElementById('btn-filter-stock').classList.add('active');
            document.querySelector('.admin-nav-btn[data-section="productos"]').click();
          });
        }
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
            '<span>' + p.nombre + '</span>' + badge +
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
            '<span><strong>#' + o.id + '</strong> — ' + (o.cliente_nombre || '—') + '</span>' +
            '<span style="color:var(--pink);font-weight:700;">' + fmt(_calcTotal(o)) + '</span>' +
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
            '<span>' + u.nombre + '</span>' +
            '<span style="color:var(--text-light);">' + u.email + '</span>' +
            '</div>';
        }).join('');
      }
    } catch (e) {
      console.error('Dashboard error:', e);
    }
  }

  /* ══════════════════════════════════════
     PRODUCTOS
  ══════════════════════════════════════ */
  var prodSearchInput = document.getElementById('prod-search');
  var prodFilterCat   = document.getElementById('prod-filter-cat');
  var btnFilterStock  = document.getElementById('btn-filter-stock');

  prodSearchInput.addEventListener('input', renderProductos);
  prodFilterCat.addEventListener('change', renderProductos);

  /* Activado desde la tarjeta "Stock bajo / agotado" del dashboard,
     o al hacer clic directamente en este botón del toolbar. */
  var _stockFiltroActivo = false;
  btnFilterStock.addEventListener('click', function () {
    _stockFiltroActivo = !_stockFiltroActivo;
    btnFilterStock.classList.toggle('active', _stockFiltroActivo);
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
        var matchStock = !_stockFiltroActivo || p.stock <= p.stock_minimo;
        return matchQ && matchCat && matchStock;
      });

      var tbody = document.getElementById('prod-tbody');
      tbody.innerHTML = '';

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-light);">Sin resultados.</td></tr>';
        document.getElementById('prod-count').textContent = '';
        return;
      }

      rows.forEach(function (p) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><img src="' + (p.imagen || '') + '" alt="' + p.nombre + '" style="width:48px;height:48px;object-fit:cover;border-radius:8px;" onerror="this.style.opacity=0.3"></td>' +
          '<td><strong>' + p.nombre + '</strong></td>' +
          '<td><span class="admin-badge">' + p.categoria + '</span></td>' +
          '<td><strong>' + fmt(p.precio) + '</strong></td>' +
          '<td>' + _stockCellHtml(p) + '</td>' +
          '<td>' + (p.destacado ? '⭐' : '—') + '</td>' +
          '<td style="color:var(--text-light);font-size:0.82rem;">' + (p.proveedor || '—') + '</td>' +
          '<td><div class="td-actions">' +
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
      document.getElementById('pf-proveedor').value  = '';
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
      document.getElementById('pf-proveedor').value  = product.proveedor || '';
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
    var proveedor   = document.getElementById('pf-proveedor').value.trim();
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

    var datos = { nombre, categoria, precio, imagen, destacado, proveedor, stock: stock, stock_minimo: stockMinimo };

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
      alert('Error: ' + e.message);
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

        /* selector de estado */
        var select = '<select class="ord-estado-select" data-id="' + o.id + '" style="font-size:0.8rem;padding:3px 6px;border-radius:6px;border:1px solid #ddd;">';
        Object.keys(ESTADO_LABELS).forEach(function (est) {
          select += '<option value="' + est + '"' + (o.estado === est ? ' selected' : '') + '>' + ESTADO_LABELS[est].text + '</option>';
        });
        select += '</select>';

        /* fila principal */
        var tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML =
          '<td><strong>#' + o.id + '</strong></td>' +
          '<td>' + (o.cliente_nombre || '—') + '<br><small style="color:var(--text-light);">' + (o.cliente_email || '') + '</small></td>' +
          '<td style="white-space:nowrap;">' + (o.fecha ? new Date(o.fecha).toLocaleDateString('es-MX') : '—') + '</td>' +
          '<td>' + badge + '<br>' + select + '</td>' +
          '<td>' + (pagoLabel[o.metodo_pago] || o.metodo_pago || '—') + '</td>' +
          '<td><strong style="color:var(--pink);">' + fmt(_calcTotal(o)) + '</strong></td>' +
          '<td style="text-align:center;">▼</td>';

        /* fila de detalle (oculta por defecto) */
        var trDetail = document.createElement('tr');
        trDetail.style.display = 'none';
        var items = o.items || [];
        var itemsHtml = items.length
          ? items.map(function (i) {
              var precio = parseFloat(i.precio || i.price || 0);
              var qty    = i.cantidad || i.qty || 1;
              return '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:0.83rem;border-bottom:1px solid #f3eeff;">' +
                '<span>' + (i.nombre || i.name || '—') + ' <span style="color:var(--text-light);">x' + qty + '</span></span>' +
                '<span style="font-weight:700;">' + fmt(precio * qty) + '</span>' +
              '</div>';
            }).join('')
          : '<p style="color:var(--text-light);font-size:0.83rem;">Sin productos registrados.</p>';

        trDetail.innerHTML =
          '<td colspan="7" style="background:#faf7ff;padding:0.8rem 1.2rem;">' +
            '<div style="font-size:0.78rem;font-weight:700;color:var(--purple);margin-bottom:0.4rem;">🍬 Productos del pedido</div>' +
            itemsHtml +
            (o.nombre_envio ? '<div style="margin-top:0.6rem;font-size:0.8rem;color:var(--text-light);">👤 ' + o.nombre_envio + (o.telefono ? ' · +52 ' + o.telefono : '') + '</div>' : '') +
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

      /* Cambiar estado desde la tabla */
      tbody.querySelectorAll('.ord-estado-select').forEach(function (sel) {
        sel.addEventListener('change', async function () {
          try {
            await apiCambiarEstadoPedido(+sel.dataset.id, sel.value);
            showToast('Estado actualizado ✓');
          } catch (e) {
            alert('Error: ' + e.message);
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
        tr.innerHTML =
          '<td><strong>' + u.nombre + '</strong></td>' +
          '<td>' + u.email + '</td>' +
          '<td><span style="background:' + rolColor + '20;color:' + rolColor + ';padding:2px 10px;border-radius:50px;font-size:0.8rem;font-weight:700;">' + u.rol + '</span></td>' +
          '<td>' + (u.fecha_registro ? new Date(u.fecha_registro).toLocaleDateString('es-MX') : '—') + '</td>' +
          '<td>' +
            (u.rol !== 'admin'
              ? '<button class="btn-admin-sm btn-edit" data-uid="' + u.id + '" data-nombre="' + u.nombre + '">👑 Hacer admin</button>'
              : '<span style="color:var(--text-light);font-size:0.8rem;">—</span>') +
          '</td>';
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('.btn-edit').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('¿Dar permisos de administrador a ' + btn.dataset.nombre + '?')) return;
          try {
            await apiCambiarRolUsuario(+btn.dataset.uid, 'admin');
            showToast(btn.dataset.nombre + ' ahora es administrador ✓');
            renderUsuarios();
          } catch (e) {
            alert('Error: ' + e.message);
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
          '<span style="flex:1;font-size:0.9rem;font-weight:600;text-transform:capitalize;">' + cat.nombre + '</span>' +
          /* Inputs de edición (ocultos por defecto) */
          '<input type="text" data-catid="' + cat.id + '" class="cat-edit-icon" value="' + (cat.icono||'🍬') + '" ' +
            'style="display:none;width:44px;padding:0.3rem 0.4rem;border:1px solid #ddd;border-radius:6px;font-size:1rem;text-align:center;" />' +
          '<input type="text" data-catid="' + cat.id + '" class="cat-edit-input" value="' + cat.nombre + '" ' +
            'style="display:none;flex:1;padding:0.3rem 0.6rem;border:1px solid #ddd;border-radius:6px;font-size:0.85rem;" />' +
          '<button class="btn-admin-sm btn-edit   cat-btn-edit"   data-catid="' + cat.id + '">✏️</button>' +
          '<button class="btn-admin-sm btn-edit   cat-btn-save"   data-catid="' + cat.id + '" style="display:none;background:#10b981;color:#fff;">💾</button>' +
          '<button class="btn-admin-sm btn-delete cat-btn-delete" data-catid="' + cat.id + '" data-nombre="' + cat.nombre + '">🗑️</button>';
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
            alert('Error: ' + e.message);
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
            alert('Error: ' + e.message);
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
      document.getElementById('cfg-instagram').value  = cfg.contacto_instagram  || '';
      document.getElementById('cfg-facebook').value   = cfg.contacto_facebook   || '';
      document.getElementById('cfg-whatsapp').value   = cfg.contacto_whatsapp   || '';
      document.getElementById('cfg-twitter').value    = cfg.contacto_twitter    || '';
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
        contacto_instagram:  document.getElementById('cfg-instagram').value.trim(),
        contacto_facebook:   document.getElementById('cfg-facebook').value.trim(),
        contacto_whatsapp:   document.getElementById('cfg-whatsapp').value.trim(),
        contacto_twitter:    document.getElementById('cfg-twitter').value.trim(),
      });
      msgEl.textContent = '✅ Cambios guardados correctamente.';
      msgEl.style.color = '#10b981';
      showToast('Configuración guardada ✓');
    } catch (e) {
      msgEl.textContent = 'Error: ' + e.message;
      msgEl.style.color = '#e74c3c';
    }
  });

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

  /* ══ Toast ══ */
  function showToast(msg) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;background:#333;color:#fff;padding:0.7rem 1.2rem;border-radius:10px;font-size:0.9rem;z-index:9999;animation:fadeIn 0.3s ease;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3000);
  }

  /* ══ Init ══ */
  loadCategorias();
  renderDashboard();
});
