/* ============================================================
   ROUTES/CATEGORIAS.JS — Dulcería Charles
   Rutas para gestionar las categorías de productos.
   - Leer categorías: público
   - Crear/editar/eliminar: solo administradores
   Las categorías se guardan en su propia tabla de la BD para
   que el admin pueda añadir o eliminar sin tocar el código.
============================================================ */

const router = require('express').Router();
const db     = require('../db');
const { adminMiddleware } = require('../middleware/auth');

/* ------------------------------------------------------------
   GET /api/categorias
   Devuelve todas las categorías ordenadas alfabéticamente.
   Público: se usa para llenar los selectores del catálogo
   y del formulario de productos en el admin.
------------------------------------------------------------ */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categorias ORDER BY nombre ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener categorías.' });
  }
});

/* ------------------------------------------------------------
   POST /api/categorias
   Crea una categoría nueva. Solo admins.
   El nombre se guarda siempre en minúsculas para consistencia.
   Recibe: { nombre: "nueva categoría" }
------------------------------------------------------------ */
router.post('/', adminMiddleware, async (req, res) => {
  const nombre = (req.body.nombre || '').trim().toLowerCase();
  const icono  = (req.body.icono  || '🍬').trim();
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  try {
    const [result] = await db.query('INSERT INTO categorias (nombre, icono) VALUES (?,?)', [nombre, icono]);
    res.json({ id: result.insertId, nombre, icono });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Esa categoría ya existe.' });
    res.status(500).json({ error: 'Error al crear categoría.' });
  }
});

/* ------------------------------------------------------------
   PUT /api/categorias/:id
   Edita el nombre de una categoría. Solo admins.
   IMPORTANTE: también actualiza todos los productos que
   usaban el nombre anterior, para que no queden huérfanos.
   Ejemplo: si renombras "paletas" a "paletas artesanales",
   todos los productos de "paletas" cambian automáticamente.
------------------------------------------------------------ */
router.put('/:id', adminMiddleware, async (req, res) => {
  const nombre = (req.body.nombre || '').trim().toLowerCase();
  const icono  = (req.body.icono  || '🍬').trim();
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  try {
    const [old] = await db.query('SELECT nombre FROM categorias WHERE id = ?', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'Categoría no encontrada.' });

    await db.query('UPDATE categorias SET nombre=?, icono=? WHERE id=?', [nombre, icono, req.params.id]);

    // Actualizamos todos los productos que tenían el nombre anterior
    await db.query('UPDATE productos SET categoria = ? WHERE categoria = ?', [nombre, old[0].nombre]);

    res.json({ id: +req.params.id, nombre, icono });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Esa categoría ya existe.' });
    res.status(500).json({ error: 'Error al editar categoría.' });
  }
});

/* ------------------------------------------------------------
   DELETE /api/categorias/:id
   Elimina una categoría. Solo admins.
   PROTECCIÓN: no se puede eliminar si hay productos activos
   usando esa categoría. Primero hay que mover o eliminar
   esos productos para poder borrar la categoría.
------------------------------------------------------------ */
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    // Obtenemos el nombre de la categoría a eliminar
    const [old] = await db.query('SELECT nombre FROM categorias WHERE id = ?', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'Categoría no encontrada.' });

    // Contamos cuántos productos activos usan esta categoría
    const [prods] = await db.query(
      'SELECT COUNT(*) as total FROM productos WHERE categoria = ? AND activo = 1',
      [old[0].nombre]
    );

    // Si hay productos activos, no permitimos eliminarla
    if (prods[0].total > 0)
      return res.status(409).json({
        error: `No se puede eliminar: hay ${prods[0].total} producto(s) en esta categoría.`
      });

    // Sin productos activos, podemos eliminarla
    await db.query('DELETE FROM categorias WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar categoría.' });
  }
});

module.exports = router;
