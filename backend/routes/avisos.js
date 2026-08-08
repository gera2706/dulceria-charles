/* ================================================================
   ARCHIVO: backend/routes/avisos.js
   PROPÓSITO: Panel admin → lista de avisos de stock bajo/agotado
   (tabla avisos_stock, ver dulceria_charles.sql). Cada fila se creó
   automáticamente al mandar el correo de alerta — ver
   backend/utils/stockAlertas.js (avisos del sistema) y
   POST /api/pedidos/:id/avisar-agotado en routes/pedidos.js
   (avisos de un cliente con un pedido incompleto).
   ACCESO: Solo administradores.
================================================================ */

const router = require('express').Router();
const db     = require('../db');
const { adminMiddleware } = require('../middleware/auth');

/* ----------------------------------------------------------------
   GET /api/avisos-stock
   Los últimos avisos (por defecto 30, ?limit= para cambiarlo), con
   el nombre del producto y, si el aviso vino de un cliente, su
   nombre y el número de pedido.
---------------------------------------------------------------- */
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);

    const [rows] = await db.query(
      `SELECT a.id, a.tipo, a.origen, a.fecha, a.pedido_id,
              pr.nombre AS producto_nombre,
              u.nombre  AS cliente_nombre
       FROM avisos_stock a
       LEFT JOIN productos pr ON pr.id = a.producto_id
       LEFT JOIN usuarios  u  ON u.id  = a.usuario_id
       ORDER BY a.fecha DESC
       LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener avisos de stock.' });
  }
});

module.exports = router;
