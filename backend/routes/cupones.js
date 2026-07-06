/* ============================================================
   ROUTES/CUPONES.JS — Dulcería Charles
   Rutas para gestionar los cupones de descuento.
   - Validar cupón: requiere estar logueado
   - Ver/crear/activar cupones: solo administradores
============================================================ */

const router = require('express').Router();
const db     = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

/* ------------------------------------------------------------
   POST /api/cupones/validar
   Verifica si un código de cupón es válido y calcula
   cuánto descuento aplica sobre el subtotal del carrito.
   Recibe: { codigo, subtotal }
   Devuelve: { ok, codigo, tipo, valor, descripcion, descuento }
------------------------------------------------------------ */
router.post('/validar', authMiddleware, async (req, res) => {
  const { codigo, subtotal } = req.body;
  if (!codigo) return res.status(400).json({ error: 'Ingresa un código.' });

  try {
    // Buscamos el cupón en la BD (en mayúsculas y sin espacios)
    const [rows] = await db.query(
      'SELECT * FROM cupones WHERE codigo = ? AND activo = 1',
      [codigo.toUpperCase().trim()]
    );

    // Si no existe o está desactivado, lo rechazamos
    if (!rows.length)
      return res.status(404).json({ error: 'Código no válido o expirado.' });

    const c = rows[0];

    // Calculamos el descuento según el tipo de cupón:
    // - "percent": descuento en porcentaje (ej: 20% de $500 = $100 de descuento)
    // - otro tipo: descuento fijo en pesos (ej: $50 menos, pero no más que el subtotal)
    const descuento = c.tipo === 'percent'
      ? Math.round((subtotal * c.valor) / 100)
      : Math.min(c.valor, subtotal);

    res.json({ ok: true, codigo: c.codigo, tipo: c.tipo, valor: c.valor,
               descripcion: c.descripcion, descuento });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

/* ------------------------------------------------------------
   GET /api/cupones
   Lista todos los cupones (activos e inactivos). Solo admins.
------------------------------------------------------------ */
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, codigo, tipo, valor, descripcion, activo FROM cupones ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cupones.' });
  }
});

/* ------------------------------------------------------------
   POST /api/cupones
   Crea un nuevo cupón de descuento. Solo admins.
   Recibe: { codigo, tipo, valor, descripcion }
   El código se guarda siempre en MAYÚSCULAS.
------------------------------------------------------------ */
router.post('/', adminMiddleware, async (req, res) => {
  const { codigo, tipo, valor, descripcion } = req.body;
  if (!codigo || !tipo || !valor)
    return res.status(400).json({ error: 'Código, tipo y valor son obligatorios.' });
  try {
    await db.query(
      'INSERT INTO cupones (codigo, tipo, valor, descripcion) VALUES (?,?,?,?)',
      [codigo.toUpperCase().trim(), tipo, valor, descripcion || '']
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    // Error de clave duplicada: ya existe un cupón con ese código
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Ya existe un cupón con ese código.' });
    res.status(500).json({ error: 'Error al crear cupón.' });
  }
});

/* ------------------------------------------------------------
   PATCH /api/cupones/:id
   Activa o desactiva un cupón. Solo admins.
   Recibe: { activo: true/false }
   Se usa para pausar cupones sin eliminarlos.
------------------------------------------------------------ */
router.patch('/:id', adminMiddleware, async (req, res) => {
  const { activo } = req.body;
  await db.query('UPDATE cupones SET activo = ? WHERE id = ?', [activo ? 1 : 0, req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
