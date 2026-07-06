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
  try {
    await db.query(
      `UPDATE pedidos
       SET estado='pendiente_entregar', metodo_pago=?, nombre_envio=?,
           telefono=?, subtotal=?, descuento=?, cupon=?, total=?
       WHERE id=? AND usuario_id=?`,
      [metodo_pago || null, nombre_envio || null, telefono || null,
       subtotal, descuento || 0, cupon || null, total,
       req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al completar pedido.' });
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
    const [result] = await conn.query(
      `INSERT INTO pedidos
        (usuario_id, subtotal, descuento, cupon, total, metodo_pago, nombre_envio, telefono)
       VALUES (?,?,?,?,?,?,?,?)`,
      [req.user.id, subtotal, descuento || 0, cupon || null, total,
       metodo_pago || null, nombre_envio || null, telefono || null]
    );
    await insertarItems(conn, result.insertId, items);
    await conn.commit();
    res.status(201).json({ ok: true, pedidoId: result.insertId });
  } catch (err) {
    await conn.rollback();
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
  try {
    await db.query('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado.' });
  }
});

module.exports = router;
