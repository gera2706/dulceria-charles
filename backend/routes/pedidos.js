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
const mailer   = require('../mailer');
const whatsapp = require('../whatsapp');
const { authMiddleware, adminMiddleware, actorLabel } = require('../middleware/auth');
const { revisarAlertaStock } = require('../utils/stockAlertas');
const { obtenerCorreoDestino } = require('../utils/correoDestino');

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
      const err = new Error('Lo sentimos, por el momento no hay suficiente "' + rows[0].nombre + '" (quedan ' + rows[0].stock + ').');
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
      const { item_id, item_nombre, item_precio, item_cantidad, item_producto_id, item_stock_actual, ...pedido } = row;
      map.set(row.id, { ...pedido, items: [] });
    }
    if (row.item_id) {
      map.get(row.id).items.push({
        id:            row.item_id,
        producto_id:   row.item_producto_id,
        nombre:        row.item_nombre,
        precio:        row.item_precio,
        cantidad:      row.item_cantidad,
        // NULL si el producto ya no existe (fue eliminado); un número
        // (incluido 0) si sigue existiendo. Lo usa pedidos.js del
        // frontend para saber si un pedido incompleto quedó "agotado".
        stock_actual:  row.item_stock_actual
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
    // Deja "quién" en esta conexión antes de escribir, para que
    // tr_pedidos_insert lo guarde en auditoria.usuario (ver db.js).
    await conn.query('SET @app_usuario = ?', [actorLabel(req)]);
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
    await conn.query('SET @app_usuario = ?', [actorLabel(req)]);
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

    // Después de confirmar la transacción (nunca antes: si algo de arriba
    // fallara y se hiciera rollback, no queremos haber mandado ya un
    // correo de "se agotó" por stock que en realidad no se llegó a vender).
    if (estadoActual === 'pendiente_finalizar') {
      for (const item of items) await revisarAlertaStock(db, item.producto_id);
    }

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
    await conn.query('SET @app_usuario = ?', [actorLabel(req)]);
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

    for (const item of itemsValidados) await revisarAlertaStock(db, item.producto_id);

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
    // Paginación OPCIONAL (?page=&limit=): el LIMIT se aplica sobre los
    // PEDIDOS, no sobre las filas del JOIN (que están "aplanadas" con
    // sus items) — si no, un LIMIT cortaría a la mitad los items de un
    // pedido. Por eso primero se eligen los IDs de pedido de esa página
    // y luego se hace el JOIN completo solo para esos IDs.
    let idsPedidos = null;
    if (req.query.page || req.query.limit) {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
      const page  = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const [totalRows] = await db.query('SELECT COUNT(*) AS n FROM pedidos WHERE usuario_id = ?', [req.user.id]);
      const [idRows] = await db.query(
        'SELECT id FROM pedidos WHERE usuario_id = ? ORDER BY fecha DESC LIMIT ? OFFSET ?',
        [req.user.id, limit, (page - 1) * limit]
      );
      idsPedidos = idRows.map(r => r.id);
      res.set('X-Total-Count', String(totalRows[0].n));
      if (!idsPedidos.length) return res.json([]);
    }

    let sql =
      `SELECT p.id, p.subtotal, p.total,
              p.estado, p.metodo_pago, p.nombre_envio, p.telefono, p.fecha,
              p.motivo_cancelacion, p.cancelado_por,
              pi.id AS item_id, pi.producto_id AS item_producto_id,
              pi.nombre AS item_nombre, pi.precio AS item_precio,
              pi.cantidad AS item_cantidad, pr.stock AS item_stock_actual
       FROM pedidos p
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       LEFT JOIN productos pr ON pr.id = pi.producto_id
       WHERE p.usuario_id = ?`;
    const vals = [req.user.id];
    if (idsPedidos) {
      sql += ` AND p.id IN (${idsPedidos.map(() => '?').join(',')})`;
      vals.push(...idsPedidos);
    }
    sql += ' ORDER BY p.fecha DESC';

    const [rows] = await db.query(sql, vals);
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
              p.motivo_cancelacion, p.cancelado_por,
              pi.id AS item_id, pi.producto_id AS item_producto_id,
              pi.nombre AS item_nombre, pi.precio AS item_precio,
              pi.cantidad AS item_cantidad, pr.stock AS item_stock_actual
       FROM pedidos p
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       LEFT JOIN productos pr ON pr.id = pi.producto_id
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
   POST /api/pedidos/:id/avisar-agotado
   El cliente tiene un pedido "pendiente_finalizar" (incompleto) con
   un producto que ya se agotó, y toca "Avisar al dueño" en Mis
   Pedidos. Manda un correo al dueño y deja constancia en
   avisos_stock (origen 'cliente') para que se vea en el panel admin.
   RECIBE: { producto_id }
   No deja avisar dos veces por el mismo pedido+producto (evita que
   varios clics manden varios correos): si ya existe un aviso de
   'cliente' para ese pedido+producto, responde ok sin repetir nada.
---------------------------------------------------------------- */
router.post('/:id/avisar-agotado', authMiddleware, async (req, res) => {
  const productoId = parseInt(req.body.producto_id, 10);
  if (!productoId) return res.status(400).json({ error: 'Falta producto_id.' });

  try {
    // El pedido tiene que ser del usuario logueado y seguir incompleto —
    // no tiene sentido avisar sobre un pedido ya cancelado o entregado.
    const [pedidoRows] = await db.query(
      'SELECT id, estado FROM pedidos WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.user.id]
    );
    if (!pedidoRows.length) return res.status(404).json({ error: 'Pedido no encontrado.' });
    if (pedidoRows[0].estado !== 'pendiente_finalizar')
      return res.status(409).json({ error: 'Este pedido ya no está pendiente.' });

    // El producto tiene que estar realmente en ese pedido...
    const [itemRows] = await db.query(
      'SELECT id FROM pedido_items WHERE pedido_id = ? AND producto_id = ?',
      [req.params.id, productoId]
    );
    if (!itemRows.length) return res.status(404).json({ error: 'Ese producto no está en el pedido.' });

    // ...y realmente estar agotado (no dejamos "avisar" de un producto
    // que sigue disponible, aunque alguien manipule la petición).
    const [prodRows] = await db.query('SELECT nombre, stock FROM productos WHERE id = ?', [productoId]);
    if (!prodRows.length) return res.status(404).json({ error: 'Producto no encontrado.' });
    if (prodRows[0].stock > 0) return res.status(409).json({ error: 'Ese producto ya tiene existencias de nuevo.' });

    // Evita reenviar el correo si el cliente le da varias veces al botón.
    const [yaAvisado] = await db.query(
      `SELECT id FROM avisos_stock WHERE pedido_id = ? AND producto_id = ? AND usuario_id = ? AND origen = 'cliente'`,
      [req.params.id, productoId, req.user.id]
    );
    if (yaAvisado.length) return res.json({ ok: true, yaAvisado: true });

    await db.query(
      `INSERT INTO avisos_stock (producto_id, tipo, origen, usuario_id, pedido_id) VALUES (?,'agotado','cliente',?,?)`,
      [productoId, req.user.id, req.params.id]
    );

    try {
      await mailer.enviarAlertaStock({
        destino: await obtenerCorreoDestino(),
        nombre: prodRows[0].nombre,
        stock: 0,
        tipo: 'agotado',
        origen: 'cliente',
        cliente: req.user.nombre || req.user.email,
        pedidoId: req.params.id
      });
    } catch (mailErr) {
      // El aviso ya quedó registrado en avisos_stock (se ve en el panel
      // igual); si solo falla el correo, no le mostramos un error al
      // cliente por algo que no depende de él.
      console.error('Error al enviar correo de aviso de stock:', mailErr);
    }

    // WhatsApp: canal aparte del correo, no truena si no está configurado.
    await whatsapp.enviarWhatsAppDueno(
      'Un cliente avisó que "' + prodRows[0].nombre + '" ya se agotó (pedido #' + req.params.id + ').'
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al avisar al dueño.' });
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
    const filtroEstado = req.query.estado && ESTADOS_VALIDOS.includes(req.query.estado);

    // Paginación OPCIONAL (?page=&limit=) — mismo enfoque de dos pasos
    // que en GET /mios: el LIMIT va sobre pedidos, no sobre filas del
    // JOIN con items. Sin page/limit, se sigue devolviendo todo (así
    // el panel admin actual no se rompe).
    let idsPedidos = null;
    if (req.query.page || req.query.limit) {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
      const page  = Math.max(parseInt(req.query.page, 10) || 1, 1);
      let countSql = 'SELECT COUNT(*) AS n FROM pedidos';
      let idSql    = 'SELECT id FROM pedidos';
      const filtroVals = [];
      if (filtroEstado) {
        countSql += ' WHERE estado = ?';
        idSql    += ' WHERE estado = ?';
        filtroVals.push(req.query.estado);
      }
      idSql += ' ORDER BY fecha DESC LIMIT ? OFFSET ?';
      const [totalRows] = await db.query(countSql, filtroVals);
      const [idRows] = await db.query(idSql, [...filtroVals, limit, (page - 1) * limit]);
      idsPedidos = idRows.map(r => r.id);
      res.set('X-Total-Count', String(totalRows[0].n));
      if (!idsPedidos.length) return res.json([]);
    }

    let sql =
      `SELECT p.id, p.subtotal, p.total,
              p.estado, p.metodo_pago, p.nombre_envio, p.telefono, p.fecha,
              p.motivo_cancelacion, p.cancelado_por,
              u.nombre AS cliente_nombre, u.email AS cliente_email,
              pi.id AS item_id, pi.producto_id AS item_producto_id,
              pi.nombre AS item_nombre, pi.precio AS item_precio,
              pi.cantidad AS item_cantidad
       FROM pedidos p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id`;
    const vals = [];
    const condiciones = [];

    if (filtroEstado) {
      condiciones.push('p.estado = ?');
      vals.push(req.query.estado);
    }
    if (idsPedidos) {
      condiciones.push(`p.id IN (${idsPedidos.map(() => '?').join(',')})`);
      vals.push(...idsPedidos);
    }
    if (condiciones.length) sql += ' WHERE ' + condiciones.join(' AND ');
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
   RECIBE: { estado, motivo } — motivo es opcional, solo se guarda
   cuando estado es 'cancelado' (se le manda al cliente por correo).
---------------------------------------------------------------- */
router.patch('/:id/estado', adminMiddleware, async (req, res) => {
  const { estado, motivo } = req.body;
  if (!ESTADOS_VALIDOS.includes(estado))
    return res.status(400).json({ error: 'Estado inválido.' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.query('SET @app_usuario = ?', [actorLabel(req)]);
    await conn.beginTransaction();

    // Traemos también el correo/nombre del cliente y el usuario_id:
    // si el pedido termina cancelado, hay que avisarle por correo
    // (ver mailer.enviarAvisoCancelacion más abajo).
    const [rows] = await conn.query(
      `SELECT p.estado, p.usuario_id, u.email AS cliente_email, u.nombre AS cliente_nombre
       FROM pedidos p LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.id = ? FOR UPDATE`,
      [req.params.id]
    );
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
    const seCancela = estado === 'cancelado' && estadoAnterior !== 'cancelado';
    if (estado === 'cancelado' && yaDescontado) {
      const [items] = await conn.query(
        'SELECT producto_id, cantidad FROM pedido_items WHERE pedido_id = ?', [req.params.id]
      );
      await restaurarStock(conn, items);
    }

    if (seCancela) {
      await conn.query(
        'UPDATE pedidos SET estado = ?, motivo_cancelacion = ?, cancelado_por = \'admin\' WHERE id = ?',
        [estado, motivo || null, req.params.id]
      );
    } else {
      await conn.query('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, req.params.id]);
    }

    await conn.commit();

    // Después de confirmar la transacción (mismo motivo que en
    // /avisar-agotado: si algo de arriba fallara, no queremos haber
    // avisado ya de una cancelación que no se llegó a aplicar).
    if (seCancela && rows[0].cliente_email) {
      try {
        await mailer.enviarAvisoCancelacion({
          destino: rows[0].cliente_email,
          paraCliente: true,
          pedidoId: req.params.id,
          motivo: motivo || null
        });
      } catch (mailErr) {
        console.error('Error al enviar correo de cancelación al cliente:', mailErr);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar estado.' });
  } finally {
    if (conn) conn.release();
  }
});

/* ----------------------------------------------------------------
   POST /api/pedidos/:id/cancelar
   El CLIENTE cancela su propio pedido (a diferencia de PATCH
   /:id/estado, que es solo para el admin). Solo se puede cancelar un
   pedido que sigue "pendiente_finalizar" o "pendiente_entregar" —
   uno ya "entregado" es un caso de devolución/reclamo, no un simple
   cancelar, y ahí sí queremos que pase por el admin.
   RECIBE: { motivo } — obligatorio, para que el dueño sepa por qué.
---------------------------------------------------------------- */
router.post('/:id/cancelar', authMiddleware, async (req, res) => {
  const motivo = (req.body.motivo || '').trim();
  if (!motivo) return res.status(400).json({ error: 'Escribe el motivo de la cancelación.' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.query('SET @app_usuario = ?', [actorLabel(req)]);
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT estado FROM pedidos WHERE id = ? AND usuario_id = ? FOR UPDATE',
      [req.params.id, req.user.id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    const estadoAnterior = rows[0].estado;

    if (!['pendiente_finalizar', 'pendiente_entregar'].includes(estadoAnterior)) {
      await conn.rollback();
      return res.status(409).json({ error: 'Este pedido ya no se puede cancelar desde aquí.' });
    }

    // "pendiente_entregar" ya había descontado stock al confirmarse —
    // hay que devolverlo. "pendiente_finalizar" nunca descontó nada.
    if (estadoAnterior === 'pendiente_entregar') {
      const [items] = await conn.query(
        'SELECT producto_id, cantidad FROM pedido_items WHERE pedido_id = ?', [req.params.id]
      );
      await restaurarStock(conn, items);
    }

    await conn.query(
      `UPDATE pedidos SET estado = 'cancelado', motivo_cancelacion = ?, cancelado_por = 'cliente' WHERE id = ?`,
      [motivo, req.params.id]
    );

    await conn.commit();

    try {
      await mailer.enviarAvisoCancelacion({
        destino: await obtenerCorreoDestino(),
        paraCliente: false,
        pedidoId: req.params.id,
        motivo: motivo,
        nombreCliente: req.user.nombre || req.user.email
      });
    } catch (mailErr) {
      console.error('Error al enviar correo de cancelación al dueño:', mailErr);
    }

    // WhatsApp: canal aparte del correo, no truena si no está configurado.
    await whatsapp.enviarWhatsAppDueno(
      (req.user.nombre || req.user.email) + ' canceló su pedido #' + req.params.id +
      (motivo ? ' — ' + motivo : '')
    );

    res.json({ ok: true });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al cancelar el pedido.' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
