document.addEventListener('DOMContentLoaded', function() {
  var container    = document.getElementById('cart-items-container');
  var emptyMsg     = document.getElementById('cart-empty');
  var summary      = document.getElementById('cart-summary');
  var totalEl      = document.getElementById('total');
  var checkoutBtn  = document.getElementById('checkout-btn');
  var modalOverlay = document.getElementById('modal-overlay');
  var modalClose   = document.getElementById('modal-close');

  function fmt(n) {
    return '$' + (Number.isInteger(n) ? n : n.toFixed(2));
  }

  function render() {
    var cart = getCart();
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

      div.innerHTML =
        imgHtml +
        '<div class="cart-item-info">' +
          '<h4>' + escapeHtml(item.name) + '</h4>' +
          '<p>' + escapeHtml(item.category) + '</p>' +
        '</div>' +
        '<div class="qty-controls">' +
          '<button class="qty-btn minus" data-id="' + item.id + '">&#8722;</button>' +
          '<span class="qty-val">' + item.qty + '</span>' +
          '<button class="qty-btn plus" data-id="' + item.id + '">+</button>' +
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

    updateSummary(cart);
  }

  function changeQty(id, delta) {
    var cart = getCart();
    var item = cart.find(function(i) { return i.id === id; });
    if (!item) return;
    item.qty += delta;
    saveCart(item.qty <= 0 ? cart.filter(function(i) { return i.id !== id; }) : cart);
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