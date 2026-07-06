/* ============================================================
   ROUTES/USUARIOS.JS — Dulcería Charles
   Rutas para gestionar los usuarios registrados.
   Todas son exclusivas para administradores.
   NOTA: la contraseña nunca se devuelve en las respuestas.
============================================================ */

const router = require('express').Router();
const db     = require('../db');
const { adminMiddleware } = require('../middleware/auth');

/* ------------------------------------------------------------
   GET /api/usuarios
   Devuelve la lista de todos los usuarios registrados.
   Solo devuelve datos básicos (no incluye la contraseña).
   Ordenados del más reciente al más antiguo.
------------------------------------------------------------ */
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      // Seleccionamos solo los campos necesarios, sin el campo "password"
      'SELECT id, nombre, email, rol, fecha_registro FROM usuarios ORDER BY fecha_registro DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
});

/* ------------------------------------------------------------
   PATCH /api/usuarios/:id/rol
   Cambia el rol de un usuario (de "cliente" a "admin" o viceversa).
   Solo admins pueden hacerlo.
   Recibe: { rol: "admin" | "cliente" }
------------------------------------------------------------ */
router.patch('/:id/rol', adminMiddleware, async (req, res) => {
  const { rol } = req.body;

  // Solo se permiten estos dos roles para evitar valores inválidos
  if (!['cliente','admin'].includes(rol))
    return res.status(400).json({ error: 'Rol inválido.' });

  try {
    await db.query('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar rol.' });
  }
});

/* ------------------------------------------------------------
   DELETE /api/usuarios/:id
   Elimina un usuario permanentemente. Solo admins.
   Tiene una protección: el admin no puede eliminarse a sí mismo,
   para evitar que el sistema se quede sin administradores.
------------------------------------------------------------ */
router.delete('/:id', adminMiddleware, async (req, res) => {
  if (+req.params.id === req.user.id)
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });

  try {
    // Verificar que el usuario a eliminar no sea el último admin
    const [target] = await db.query('SELECT rol FROM usuarios WHERE id = ?', [req.params.id]);
    if (!target.length) return res.status(404).json({ error: 'Usuario no encontrado.' });

    if (target[0].rol === 'admin') {
      const [admins] = await db.query("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin'");
      if (admins[0].n <= 1)
        return res.status(400).json({ error: 'No puedes eliminar el único administrador del sistema.' });
    }

    await db.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar usuario.' });
  }
});

module.exports = router;
