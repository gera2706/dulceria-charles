/* ================================================================
   ARCHIVO: backend/routes/historial.js
   PROPÓSITO: Panel admin → sección "Historial de cambios". Lee la
   tabla `auditoria`, que se llena SOLA gracias a 8 triggers de MySQL
   cada vez que se crea, cambia o elimina algo en productos, pedidos
   o usuarios (ver dulceria_charles_hosting.sql — sección TRIGGERS).
   El backend nunca escribe aquí directamente.

   ¿QUIÉN QUEDA REGISTRADO? Desde el 13-ago-2026, el campo `usuario`
   sí distingue qué admin (o cliente, en pedidos/registro) hizo el
   cambio — antes existía la columna pero ningún trigger la llenaba.
   Ver db.js → conActor() y middleware/auth.js → actorLabel().

   NO CONFUNDIR con backend/routes/auditorias.js: ese archivo sirve
   los REPORTES HTML de bugs/seguridad de docs/auditorias/ — cosas
   completamente distintas que por coincidencia comparten la palabra
   "auditoría". Por eso esta sección del panel se llama "Historial
   de cambios" y no "Auditoría", para no mezclarlas.

   ACCESO: Solo administradores.
================================================================ */

const router = require('express').Router();
const db     = require('../db');
const { adminMiddleware } = require('../middleware/auth');

const TABLAS_VALIDAS  = ['productos', 'pedidos', 'usuarios'];
const ACCIONES_VALIDAS = ['INSERT', 'UPDATE', 'DELETE'];

/* ----------------------------------------------------------------
   GET /api/historial
   Filtros opcionales (todos vía querystring):
     ?tabla=productos|pedidos|usuarios
     ?accion=INSERT|UPDATE|DELETE
     ?limit=50   (máximo 200, por defecto 50)
   Devuelve lo más reciente primero, incluyendo datos_anteriores/
   datos_nuevos (JSON) para poder mostrar el detalle de cada cambio.
---------------------------------------------------------------- */
router.get('/', adminMiddleware, async (req, res) => {
  try {
    let sql =
      `SELECT id_auditoria, tabla_afectada, accion, id_registro, usuario,
              descripcion, datos_anteriores, datos_nuevos, fecha
       FROM auditoria WHERE 1=1`;
    const vals = [];

    if (TABLAS_VALIDAS.includes(req.query.tabla)) {
      sql += ' AND tabla_afectada = ?';
      vals.push(req.query.tabla);
    }
    if (ACCIONES_VALIDAS.includes(req.query.accion)) {
      sql += ' AND accion = ?';
      vals.push(req.query.accion);
    }

    sql += ' ORDER BY fecha DESC, id_auditoria DESC';

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    sql += ' LIMIT ?';
    vals.push(limit);

    const [rows] = await db.query(sql, vals);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el historial de cambios.' });
  }
});

module.exports = router;
