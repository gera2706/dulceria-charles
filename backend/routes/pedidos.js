/* ================================================================
   ROUTES/PEDIDOS.JS — Dulcería Charles
   Maneja el ciclo de vida de los pedidos (modelo pickup).
   Estados:
     pendiente_finalizar → cliente entró a pago pero no confirmó
     pendiente_entregar  → pago confirmado, listo para recoger
     entregado           → cliente recogió su pedido
     cancelado           → pedido cancelado
================================================================ */

const router = require('express').Router();
const db     = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const ESTADOS_VALIDOS = ['pendiente_finalizar','pendiente_entregar','entregado','cancelado'];

/* ── Función auxiliar: insertar items del pedido ──────────────
   Centraliza la lógica para no repetirla en cada ruta.
   Acepta los campos con los nombres del frontend (name/price/qty)
   y también los del backend (nombre/precio/cantidad).
────────────────────────────────────────────────────────────── */
async function insertarItems(conn, pedidoId, items) {
  for (const item of items) {
    await conn.query(
      'INSERT INTO pedido_items (pedido_id, producto_id, nombre, precio, cantidad) VALUES (?,?,?,?,?)',
      [pedidoId, item.id || null,
       item.name  || item.nombre,
       item.price || item.precio,
       item.qty   || item.cantidad]
    );
  }
}

/* ── Función auxiliar: valida y descuenta stock ────────────────
   Se llama DENTRO de una transacción, justo antes de confirmar un
   pedido como pagado. Por cada ítem:
     1. Bloquea la fila del producto con FOR UPDATE, para que dos
        compras simultáneas no puedan vender el mismo stock dos veces.
     2. Si no alcanza el stock, lanza un error (con status 409) que
        cancela TODA la transacción — el pedido nunca queda confirmado
        a medias ni el stock queda en negativo.
     3. Si alcanza, lo descuenta.
   items: array de { producto_id, cantidad }.
────────────────────────────────────────────────────────────── */
async function validarYDescontarStock(conn, items) {
  for (const item of items) {
    const productoId = item.producto_id;
    const cantidad    = item.cantidad;
    if (!productoId) continue; // ítem sin producto asociado (no debería pasar, pero no truena)

    const [rows] = await conn.query(
      'SELECT nombre, stock FROM productos WHERE id = ? FOR UPDATE', [productoId]
    );
    if (!rows.length) continue; // el producto fue eliminado; no bloqueamos el pedido por eso

    if (rows[0].stock < cantidad) {
      const err = new Error('No hay suficiente stock de "' + rows[0].nombre + '" (quedan ' + rows[0].stock + ').');
      err.status = 409; // "Conflicto": el pedido ya no se puede cumplir con lo que hay disponible
      throw err;
    }

    await conn.query('UPDATE productos SET stock = stock - ? WHERE id = ?', [cantidad, productoId]);
  }
}

/* ── Función auxiliar: devuelve al stock los items de un pedido ──
   Se usa cuando un pedido YA confirmado (que ya había descontado
   stock) se cancela: las piezas regresan al inventario. ──────── */
async function restaurarStock(conn, items) {
  for (const item of items) {
    if (!item.producto_id) continue;
    await conn.query('UPDATE productos SET stock = stock + ? WHERE id = ?', [item.cantidad, item.producto_id]);
  }
}

/* ── Función auxiliar: agrupar filas de JOIN en pedidos+items ──
   Convierte el resultado plano de un LEFT JOIN en un array de
   pedidos, cada uno con su array de items anidado.
   Evita el problema N+1 (una query por pedido).
────────────────────────────────────────────────────────────── */
function agruparPedidosConItems(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.id)) {
      const { item_id, item_nombre, item_precio, item_cantidad, item_producto_id, ...pedido } = row;
      map.set(row.id, { ...pedido, items: [] });
    }
    if (row.item_id) {
      map.get(row.id).items.push({
        id:          row.item_id,
        producto_id: row.item_producto_id,
        nombre:      row.item_nombre,
        precio:      row.item_precio,
        cantidad:    row.item_cantidad
      });
    }
  }
  return Array.from(map.values());
}

/* ----------------------------------------------------------------
   POST /api/pedidos/inconcluso
   Guarda el pedido como "pendiente_finalizar" al entrar a pago.html.
---------------------------------------------------------------- */
router.post('/inconcluso', authMiddleware, async (req, res) => {
  const { items, subtotal, descuento, cupon, total } = req.body;
  if (!items || !items.length)
    return res.status(400).json({ error: 'El carrito está vacío.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO pedidos (usuario_id, subtotal, descuento, cupon, total, estado)
       VALUES (?,?,?,?,?,'pendiente_finalizar')`,
      [req.user.id, subtotal, descuento || 0, cupon || null, total]
    );
    await insertarItems(conn, result.insertId, items);
    await conn.commit();
    res.status(201).json({ ok: true, pedidoId: result.insertId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al guardar pedido.' });
  } finally {
    conn.release();
  }
});

/* ----------------------------------------------------------------
   PUT /api/pedidos/:id/completar
   Confirma el pedido: cambia estado a "pendiente_entregar".
---------------------------------------------------------------- */
router.put('/:id/completar', authMiddleware, async (req, res) => {
  const { metodo_pago, nombre_envio, telefono, subtotal, descuento, cupon, total } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE bloquea el pedido mientras decidimos si hay que descontar
    // stock. También sirve para confirmar que el pedido es de este usuario.
    const [pedidoRows] = await conn.query(
      'SELECT estado FROM pedidos WHERE id = ? AND usuario_id = ? FOR UPDATE',
      [req.params.id, req.user.id]
    );
    if (!pedidoRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    // Solo descontamos stock si el pedido sigue "pendiente_finalizar".
    // Si ya estaba confirmado (ej: el usuario reenvió el formulario dos
    // veces), NO volvemos a descontar — ya se descontó la primera vez.
    if (pedidoRows[0].estado === 'pendiente_finalizar') {
      const [items] = await conn.query(
        'SELECT producto_id, cantidad FROM pedido_items WHERE pedido_id = ?', [req.params.id]
      );
      await validarYDescontarStock(conn, items);
    }

    await conn.query(
      `UPDATE pedidos
       SET estado='pendiente_entregar', metodo_pago=?, nombre_envio=?,
           telefono=?, subtotal=?, descuento=?, cupon=?, total=?
       WHERE id=? AND usuario_id=?`,
      [metodo_pago || null, nombre_envio || null, telefono || null,
       subtotal, descuento || 0, cupon || null, total,
       req.params.id, req.user.id]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    if (err.status === 409) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al completar pedido.' });
  } finally {
    conn.release();
  }
});

/* ----------------------------------------------------------------
   POST /api/pedidos
   Crea un pedido completo directamente (sin inconcluso previo).
---------------------------------------------------------------- */
router.post('/', authMiddleware, async (req, res) => {
  const { items, subtotal, descuento, cupon, total,
          metodo_pago, nombre_envio, telefono } = req.body;

  if (!items || !items.length)
    return res.status(400).json({ error: 'El carrito está vacío.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Este pedido nace directamente como "confirmado" (no pasó por
    // /inconcluso), así que aquí SÍ descontamos stock siempre.
    await validarYDescontarStock(conn, items.map(function (i) {
      return { producto_id: i.id || i.producto_id, cantidad: i.qty || i.cantidad };
    }));

    const [result] = await conn.query(
      `INSERT INTO pedidos
        (usuario_id, subtotal, descuento, cupon, total, metodo_pago, nombre_envio, telefono, estado)
       VALUES (?,?,?,?,?,?,?,?,'pendiente_entregar')`,
      [req.user.id, subtotal, descuento || 0, cupon || null, total,
       metodo_pago || null, nombre_envio || null, telefono || null]
    );
    await insertarItems(conn, result.insertId, items);
    await conn.commit();
    res.status(201).json({ ok: true, pedidoId: result.insertId });
  } catch (err) {
    await conn.rollback();
    if (err.status === 409) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el pedido.' });
  } finally {
    conn.release();
  }
});

/* ----------------------------------------------------------------
   GET /api/pedidos/mios
   Pedidos del cliente logueado con sus items — un solo JOIN.
---------------------------------------------------------------- */
router.get('/mios', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.subtotal, p.descuento, p.cupon, p.total,
              p.estado, p.metodo_pago, p.nombre_envio, p.telefono, p.fecha,
              pi.id AS item_id, pi.producto_id AS item_producto_id,
              pi.nombre AS item_nombre, pi.precio AS item_precio,
              pi.cantidad AS item_cantidad
       FROM pedidos p
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       WHERE p.usuario_id = ?
       ORDER BY p.fecha DESC`,
      [req.user.id]
    );
    res.json(agruparPedidosConItems(rows));
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
});

/* ----------------------------------------------------------------
   GET /api/pedidos/:id
   Un pedido específico del cliente logueado con sus items.
---------------------------------------------------------------- */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.subtotal, p.descuento, p.cupon, p.total,
              p.estado, p.metodo_pago, p.nombre_envio, p.telefono, p.fecha,
              pi.id AS item_id, pi.producto_id AS item_producto_id,
              pi.nombre AS item_nombre, pi.precio AS item_precio,
              pi.cantidad AS item_cantidad
       FROM pedidos p
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       WHERE p.id = ? AND p.usuario_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pedido no encontrado.' });
    const [pedido] = agruparPedidosConItems(rows);
    res.json(pedido);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedido.' });
  }
});

/* ----------------------------------------------------------------
   GET /api/pedidos
   Todos los pedidos (admin) con nombre/email del cliente — un solo JOIN.
---------------------------------------------------------------- */
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.subtotal, p.descuento, p.cupon, p.total,
              p.estado, p.metodo_pago, p.nombre_envio, p.telefono, p.fecha,
              u.nombre AS cliente_nombre, u.email AS cliente_email,
              pi.id AS item_id, pi.producto_id AS item_producto_id,
              pi.nombre AS item_nombre, pi.precio AS item_precio,
              pi.cantidad AS item_cantidad
       FROM pedidos p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       ORDER BY p.fecha DESC`
    );
    res.json(agruparPedidosConItems(rows));
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
});

/* ----------------------------------------------------------------
   PATCH /api/pedidos/:id/estado
   Cambia el estado de un pedido (admin).
---------------------------------------------------------------- */
router.patch('/:id/estado', adminMiddleware, async (req, res) => {
  const { estado } = req.body;
  if (!ESTADOS_VALIDOS.includes(estado))
    return res.status(400).json({ error: 'Estado inválido.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT estado FROM pedidos WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    const estadoAnterior = rows[0].estado;

    // Si se cancela un pedido que YA había descontado stock (estaba
    // pagado/confirmado o incluso ya entregado), regresamos las piezas
    // al inventario. Si venía de "pendiente_finalizar", nunca se
    // descontó nada, así que no hay nada que restaurar.
    const yaDescontado = ['pendiente_entregar', 'entregado'].includes(estadoAnterior);
    if (estado === 'cancelado' && yaDescontado) {
      const [items] = await conn.query(
        'SELECT producto_id, cantidad FROM pedido_items WHERE pedido_id = ?', [req.params.id]
      );
      await restaurarStock(conn, items);
    }

    await conn.query('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, req.params.id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar estado.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
