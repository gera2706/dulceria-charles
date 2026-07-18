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

/* Transiciones de estado permitidas (auditoría: antes cualquier estado
   podía saltar a cualquier otro, lo que permitía "reconfirmar" un
   pedido cancelado/entregado o cancelar dos veces seguidas duplicando
   la restauración de stock). "cancelado" es un estado final: una vez
   cancelado, no se puede reabrir. */
const TRANSICIONES_VALIDAS = {
  pendiente_finalizar: ['pendiente_entregar', 'cancelado'],
  pendiente_entregar:  ['entregado', 'cancelado'],
  entregado:           ['cancelado'],
  cancelado:           []
};

/* ── Función auxiliar: valida el carrito contra la BD y construye
   los items "de verdad" ────────────────────────────────────────
   FIX DE SEGURIDAD (auditoría, hallazgo crítico): antes el precio y
   la cantidad de cada producto venían directo del body que manda el
   navegador (item.price/item.qty), así que cualquier usuario podía
   editar el JSON y comprar a cualquier precio, o mandar cantidades
   negativas. Ahora SIEMPRE se busca el precio real en la tabla
   productos y se ignora cualquier precio que haya mandado el cliente.
   items: array del carrito, con producto_id en item.id o item.producto_id
   y cantidad en item.qty o item.cantidad.
   Devuelve: [{ producto_id, nombre, precio, cantidad }, ...]
────────────────────────────────────────────────────────────── */
async function construirItemsValidados(conn, items) {
  if (!Array.isArray(items) || !items.length) {
    const err = new Error('El carrito está vacío.');
    err.status = 400;
    throw err;
  }

  const itemsValidados = [];
  for (const item of items) {
    const productoId = item.id || item.producto_id;
    const cantidad    = parseInt(item.qty != null ? item.qty : item.cantidad, 10);

    if (!productoId || !Number.isInteger(cantidad) || cantidad <= 0) {
      const err = new Error('Cantidad inválida en uno de los productos del carrito.');
      err.status = 400;
      throw err;
    }

    // Precio y nombre SIEMPRE desde la BD, nunca desde lo que mandó el cliente.
    const [rows] = await conn.query('SELECT id, nombre, precio FROM productos WHERE id = ?', [productoId]);
    if (!rows.length) {
      const err = new Error('Uno de los productos del carrito ya no está disponible.');
      err.status = 400;
      throw err;
    }

    itemsValidados.push({
      producto_id: rows[0].id,
      nombre:      rows[0].nombre,
      precio:      rows[0].precio,
      cantidad:    cantidad
    });
  }
  return itemsValidados;
}

/* Suma precio*cantidad de una lista de items ya validados/reales. */
function calcularTotal(itemsValidados) {
  return itemsValidados.reduce((s, i) => s + Number(i.precio) * i.cantidad, 0);
}

/* ── Función auxiliar: insertar items del pedido ──────────────
   Recibe items YA validados (con precio/nombre reales de la BD,
   ver construirItemsValidados), no datos crudos del cliente.
────────────────────────────────────────────────────────────── */
async function insertarItems(conn, pedidoId, itemsValidados) {
  for (const item of itemsValidados) {
    await conn.query(
      'INSERT INTO pedido_items (pedido_id, producto_id, nombre, precio, cantidad) VALUES (?,?,?,?,?)',
      [pedidoId, item.producto_id, item.nombre, item.precio, item.cantidad]
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
   subtotal/total se calculan aquí, en el servidor — ya no se reciben
   del body (ver construirItemsValidados).
---------------------------------------------------------------- */
router.post('/inconcluso', authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const itemsValidados = await construirItemsValidados(conn, req.body.items);
    const total = calcularTotal(itemsValidados);

    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO pedidos (usuario_id, subtotal, total, estado)
       VALUES (?,?,?,'pendiente_finalizar')`,
      [req.user.id, total, total]
    );
    await insertarItems(conn, result.insertId, itemsValidados);
    await conn.commit();
    res.status(201).json({ ok: true, pedidoId: result.insertId });
  } catch (err) {
    if (conn) await conn.rollback();
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al guardar pedido.' });
  } finally {
    if (conn) conn.release();
  }
});

/* ----------------------------------------------------------------
   PUT /api/pedidos/:id/completar
   Confirma el pedido: cambia estado a "pendiente_entregar".
   El total se recalcula desde pedido_items (ya validados al
   guardarse en /inconcluso), nunca desde lo que mande el cliente.
---------------------------------------------------------------- */
router.put('/:id/completar', authMiddleware, async (req, res) => {
  const { metodo_pago, nombre_envio, telefono } = req.body;
  let conn;
  try {
    conn = await db.getConnection();
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

    // Un pedido cancelado o ya entregado no se puede "completar" de nuevo
    // (evita reconfirmar/duplicar un pedido que ya terminó su ciclo).
    const estadoActual = pedidoRows[0].estado;
    if (estadoActual === 'cancelado' || estadoActual === 'entregado') {
      await conn.rollback();
      return res.status(409).json({ error: 'Este pedido ya no se puede modificar (estado: ' + estadoActual + ').' });
    }

    const [items] = await conn.query(
      'SELECT producto_id, precio, cantidad FROM pedido_items WHERE pedido_id = ?', [req.params.id]
    );
    const total = calcularTotal(items);

    // Solo descontamos stock si el pedido sigue "pendiente_finalizar".
    // Si ya estaba confirmado (ej: el usuario reenvió el formulario dos
    // veces), NO volvemos a descontar — ya se descontó la primera vez.
    if (estadoActual === 'pendiente_finalizar') {
      await validarYDescontarStock(conn, items);
    }

    await conn.query(
      `UPDATE pedidos
       SET estado='pendiente_entregar', metodo_pago=?, nombre_envio=?,
           telefono=?, subtotal=?, total=?
       WHERE id=? AND usuario_id=?`,
      [metodo_pago || null, nombre_envio || null, telefono || null,
       total, total, req.params.id, req.user.id]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    if (conn) await conn.rollback();
    if (err.status === 409) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al completar pedido.' });
  } finally {
    if (conn) conn.release();
  }
});

/* ----------------------------------------------------------------
   POST /api/pedidos
   Crea un pedido completo directamente (sin inconcluso previo).
---------------------------------------------------------------- */
router.post('/', authMiddleware, async (req, res) => {
  const { items, metodo_pago, nombre_envio, telefono } = req.body;

  let conn;
  try {
    conn = await db.getConnection();
    const itemsValidados = await construirItemsValidados(conn, items);
    const total = calcularTotal(itemsValidados);

    await conn.beginTransaction();

    // Este pedido nace directamente como "confirmado" (no pasó por
    // /inconcluso), así que aquí SÍ descontamos stock siempre.
    await validarYDescontarStock(conn, itemsValidados);

    const [result] = await conn.query(
      `INSERT INTO pedidos
        (usuario_id, subtotal, total, metodo_pago, nombre_envio, telefono, estado)
       VALUES (?,?,?,?,?,?,'pendiente_entregar')`,
      [req.user.id, total, total, metodo_pago || null, nombre_envio || null, telefono || null]
    );
    await insertarItems(conn, result.insertId, itemsValidados);
    await conn.commit();
    res.status(201).json({ ok: true, pedidoId: result.insertId });
  } catch (err) {
    if (conn) await conn.rollback();
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el pedido.' });
  } finally {
    if (conn) conn.release();
  }
});

/* ----------------------------------------------------------------
   GET /api/pedidos/mios
   Pedidos del cliente logueado con sus items — un solo JOIN.
---------------------------------------------------------------- */
router.get('/mios', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.subtotal, p.total,
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
      `SELECT p.id, p.subtotal, p.total,
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
   Acepta ?estado= para filtrar del lado del servidor (antes el
   filtrado por estado se hacía siempre en el cliente después de
   traer TODOS los pedidos con todos sus items; con el filtro aquí
   además se aprovecha el índice idx_estado de la tabla).
---------------------------------------------------------------- */
router.get('/', adminMiddleware, async (req, res) => {
  try {
    let sql =
      `SELECT p.id, p.subtotal, p.total,
              p.estado, p.metodo_pago, p.nombre_envio, p.telefono, p.fecha,
              u.nombre AS cliente_nombre, u.email AS cliente_email,
              pi.id AS item_id, pi.producto_id AS item_producto_id,
              pi.nombre AS item_nombre, pi.precio AS item_precio,
              pi.cantidad AS item_cantidad
       FROM pedidos p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id`;
    const vals = [];

    if (req.query.estado && ESTADOS_VALIDOS.includes(req.query.estado)) {
      sql += ' WHERE p.estado = ?';
      vals.push(req.query.estado);
    }
    sql += ' ORDER BY p.fecha DESC';

    const [rows] = await db.query(sql, vals);
    res.json(agruparPedidosConItems(rows));
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
});

/* ----------------------------------------------------------------
   PATCH /api/pedidos/:id/estado
   Cambia el estado de un pedido (admin). Valida que la transición
   tenga sentido (ver TRANSICIONES_VALIDAS) para evitar reabrir un
   pedido cancelado o duplicar la restauración de stock.
---------------------------------------------------------------- */
router.patch('/:id/estado', adminMiddleware, async (req, res) => {
  const { estado } = req.body;
  if (!ESTADOS_VALIDOS.includes(estado))
    return res.status(400).json({ error: 'Estado inválido.' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT estado FROM pedidos WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    const estadoAnterior = rows[0].estado;

    // Si el estado no cambia, no hay nada que validar ni tocar.
    if (estado !== estadoAnterior) {
      const permitidas = TRANSICIONES_VALIDAS[estadoAnterior] || [];
      if (!permitidas.includes(estado)) {
        await conn.rollback();
        return res.status(409).json({ error: 'No se puede cambiar el pedido de "' + estadoAnterior + '" a "' + estado + '".' });
      }
    }

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
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar estado.' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
