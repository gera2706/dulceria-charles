/* ============================================================
   ROUTES/FAVORITOS.JS — Dulcería Charles
   Rutas para guardar y consultar los productos favoritos
   de cada usuario. Requieren estar logueado.
   Los favoritos se guardan en la tabla "favoritos" de la BD,
   relacionando usuario_id con producto_id.
============================================================ */

const router = require('express').Router();
const db     = require('../db');
const { authMiddleware } = require('../middleware/auth');

/* ------------------------------------------------------------
   GET /api/favoritos
   Devuelve todos los productos favoritos del usuario logueado.
   Hace un JOIN para traer los datos completos del producto
   (nombre, precio, imagen, etc.) en lugar de solo el ID.
------------------------------------------------------------ */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      /* Unimos la tabla favoritos con productos para obtener
         los datos completos de cada producto favorito */
      `SELECT p.* FROM favoritos f
       JOIN productos p ON p.id = f.producto_id
       WHERE f.usuario_id = ? AND p.activo = 1
       ORDER BY f.fecha DESC`, // los más recientes primero
      [req.user.id] // solo los favoritos del usuario actual
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener favoritos.' });
  }
});

/* ------------------------------------------------------------
   POST /api/favoritos/:productoId
   Agrega un producto a favoritos del usuario logueado.
   Usa INSERT IGNORE para que no falle si ya estaba guardado
   (evita duplicados sin lanzar un error).
------------------------------------------------------------ */
router.post('/:productoId', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'INSERT IGNORE INTO favoritos (usuario_id, producto_id) VALUES (?,?)',
      [req.user.id, req.params.productoId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar favorito.' });
  }
});

/* ------------------------------------------------------------
   DELETE /api/favoritos/:productoId
   Quita un producto de favoritos del usuario logueado.
   Solo borra el registro que coincide con el usuario actual
   (un usuario no puede quitar favoritos de otro).
------------------------------------------------------------ */
router.delete('/:productoId', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM favoritos WHERE usuario_id = ? AND producto_id = ?',
      [req.user.id, req.params.productoId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al quitar favorito.' });
  }
});

module.exports = router;
