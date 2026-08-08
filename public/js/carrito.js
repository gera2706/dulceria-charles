document.addEventListener('DOMContentLoaded', async function() {
  var container    = document.getElementById('cart-items-container');
  var emptyMsg     = document.getElementById('cart-empty');
  var summary      = document.getElementById('cart-summary');
  var totalEl      = document.getElementById('total');
  var checkoutBtn  = document.getElementById('checkout-btn');
  var modalOverlay = document.getElementById('modal-overlay');
  var modalClose   = document.getElementById('modal-close');

  /* Necesitamos el stock REAL y actual de cada producto para no dejar
     que el carrito acumule más piezas de las que hay en existencia
     (antes esta página no tenía ningún tope: se podía escribir
     cualquier cantidad con los botones +/- o a mano). loadProducts()
     llena DC_PRODUCTS_CACHE (data.js) con los datos frescos de la API,
     incluido el stock; getAllProducts()/stockOf() ya lo pueden leer
     antes de pintar el primer render(). */
  if (typeof loadProducts === 'function') {
    try { await loadProducts(); } catch (e) { /* sin conexión: seguimos con el fallback estático */ }
  }

  function fmt(n) {
    return '$' + (Number.isInteger(n) ? n : n.toFixed(2));
  }

  /* Stock disponible de un producto ahora mismo. null = no sabemos
     (producto viejo sin migrar o no encontrado) -> no bloqueamos la
     cantidad en ese caso, igual que en la tarjeta del catálogo. */
  function stockInfo(id) {
    var p = (typeof getAllProducts === 'function') ? getAllProducts().find(function(pr) { return pr.id === id; }) : null;
    if (!p || p.stock === undefined) return { max: 99, known: false, stockMinimo: undefined };
    return { max: p.stock, known: true, stockMinimo: p.stock_minimo };
  }

  function render() {
    var cart = getCart();

    /* Antes de dibujar nada: si el stock de algún producto bajó desde
       que se agregó al carrito (alguien más lo compró, se acabó, el
       admin bajó la existencia...), corregimos el carrito ahora mismo
       en vez de dejar que el cliente llegue hasta pagar y el backend
       rechace el pedido. */
    var corregidos  = [];
    var eliminados  = [];
    var cartCorregido = cart.filter(function(item) {
      var info = stockInfo(item.id);
      if (!info.known) return true; // no sabemos su stock: lo dejamos como está
      if (info.max <= 0) { eliminados.push(item.name); return false; } // ya no hay ninguna pieza
      if (item.qty > info.max) { item.qty = info.max; corregidos.push(item.name); }
      return true;
    });
    if (eliminados.length || corregidos.length) {
      saveCart(cartCorregido);
      cart = cartCorregido;
      // Esto pasa sin que el cliente haga nada (alguien más compró el
      // producto mientras estaba en su carrito) — antes se avisaba con
      // un toast que desaparecía en 2.5s y era fácil no alcanzar a leerlo.
      // Al ser un cambio silencioso e importante (le quitamos algo de su
      // carrito), usamos el modal con "Aceptar" en vez del toast.
      if (eliminados.length) {
        dcAlert('Ya no tenemos ' + (eliminados.length > 1 ? 'existencias de estos productos' : eliminados[0]) + ' — se ' + (eliminados.length > 1 ? 'quitaron' : 'quitó') + ' de tu carrito.');
      } else {
        dcAlert(corregidos.length > 1
          ? 'Bajamos la cantidad de ' + corregidos.length + ' productos porque ya no hay tantas piezas disponibles.'
          : 'Solo quedan piezas limitadas de ' + corregidos[0] + ' — ajustamos la cantidad en tu carrito.');
      }
    }

    container.innerHTML = '';

    if (cart.length === 0) {
      emptyMsg.classList.remove('hidden');
      summary.style.display = 'none';
      return;
    }

    emptyMsg.classList.add('hidden');
    summary.style.display = '';

    /* texto del botón según sesión */
    if (!isLoggedIn()) {
      checkoutBtn.textContent = '🔐 Inicia sesión para comprar';
    } else {
      checkoutBtn.textContent = '🛒 Realizar pedido';
    }

    cart.forEach(function(item) {
      var div = document.createElement('div');
      div.className = 'cart-item';

      var imgHtml = item.image
        ? '<img class="cart-item-img" src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name) + '" ' +
            'onerror="this.onerror=null;this.src=\'\';this.style.background=\'#f3ecff\'">'
        : '<div class="cart-item-img" style="background:#f3ecff;display:flex;align-items:center;justify-content:center;font-size:1.8rem;">&#127852;</div>';

      var info    = stockInfo(item.id);
      var maxQty  = info.max;
      var atMax   = item.qty >= maxQty;
      /* Aviso de disponibilidad: si ya se llevó todo el stock a este
         carrito, o si queda poco (mismo criterio que el catálogo:
         stock <= stock_minimo), se lo hacemos saber al cliente aquí
         mismo en vez de que se entere hasta que falle el pedido. */
      var stockNoteHtml = '';
      if (info.known && atMax) {
        stockNoteHtml = '<p class="cart-item-stock-note">Es todo el stock disponible</p>';
      } else if (info.known && info.stockMinimo !== undefined && maxQty <= info.stockMinimo) {
        stockNoteHtml = '<p class="cart-item-stock-note">¡Solo quedan ' + maxQty + ' disponibles!</p>';
      }

      div.innerHTML =
        imgHtml +
        '<div class="cart-item-info">' +
          '<h4>' + escapeHtml(item.name) + '</h4>' +
          '<p>' + escapeHtml(item.category) + '</p>' +
          stockNoteHtml +
        '</div>' +
        '<div class="qty-controls">' +
          '<button class="qty-btn minus" data-id="' + item.id + '">&#8722;</button>' +
          '<input type="number" class="qty-val" data-id="' + item.id + '" value="' + item.qty + '" min="1" max="' + maxQty + '" step="1" inputmode="numeric" aria-label="Cantidad">' +
          '<button class="qty-btn plus" data-id="' + item.id + '"' + (atMax ? ' disabled' : '') + '>+</button>' +
        '</div>' +
        '<span class="cart-item-price">' + fmt(item.price * item.qty) + '</span>' +
        '<button class="remove-btn" data-id="' + item.id + '" title="Eliminar">&#x2715;</button>';

      container.appendChild(div);
    });

    container.querySelectorAll('.plus').forEach(function(btn) {
      btn.addEventListener('click', function() { changeQty(+btn.dataset.id, 1); });
    });
    container.querySelectorAll('.minus').forEach(function(btn) {
      btn.addEventListener('click', function() { changeQty(+btn.dataset.id, -1); });
    });
    container.querySelectorAll('.remove-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { removeItem(+btn.dataset.id); });
    });

    /* Escribir la cantidad directo en el campo, igual que en el catálogo
       y el modal de producto: no se corrige mientras se escribe, solo al
       salir del campo o presionar Enter, para no estorbar a media
       escritura (ej. al borrar el "2" para poner "12"). */
    container.querySelectorAll('.qty-val').forEach(function(input) {
      input.addEventListener('change', function() { setQty(+input.dataset.id, input.value); });
      input.addEventListener('keydown', function(e) { if (e.key === 'Enter') input.blur(); });
    });

    updateSummary(cart);
  }

  function changeQty(id, delta) {
    var cart = getCart();
    var item = cart.find(function(i) { return i.id === id; });
    if (!item) return;

    if (delta > 0) {
      var info = stockInfo(id);
      if (info.known && item.qty >= info.max) {
        showToast('Lo sentimos, por el momento no contamos con más piezas disponibles de ' + item.name + '.');
        return;
      }
    }

    item.qty += delta;
    saveCart(item.qty <= 0 ? cart.filter(function(i) { return i.id !== id; }) : cart);
    render();
  }

  /* Fija la cantidad a un valor absoluto (tecleado a mano). Un valor no
     numérico o menor a 1 se trata como 1 en vez de eliminar el producto:
     para quitarlo ya existe el botón "×" dedicado, no queremos que se
     vaya sin querer por borrar el campo. Si lo tecleado se pasa del
     stock disponible, se recorta al máximo y se avisa (igual que al
     agregar desde el catálogo). */
  function setQty(id, rawValue) {
    var cart = getCart();
    var item = cart.find(function(i) { return i.id === id; });
    if (!item) return;

    var qty = parseInt(rawValue, 10);
    if (isNaN(qty) || qty < 1) qty = 1;

    var info = stockInfo(id);
    if (info.known && qty > info.max) {
      qty = info.max;
      showToast('Lo sentimos, por el momento solo tenemos ' + info.max + (info.max === 1 ? ' pieza disponible' : ' piezas disponibles') + ' de ' + item.name + '.');
    }

    item.qty = qty;
    saveCart(cart);
    render();
  }

  function removeItem(id) {
    saveCart(getCart().filter(function(i) { return i.id !== id; }));
    render();
  }

  function updateSummary(cart) {
    var total = cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
    totalEl.textContent = fmt(total);
  }

  checkoutBtn.addEventListener('click', function() {
    if (!isLoggedIn()) {
      window.location.href = 'login.html?next=pago.html';
      return;
    }
    window.location.href = 'pago.html';
  });

  modalClose.addEventListener('click', function() {
    window.location.href = 'index.html';
  });

  render();
});
