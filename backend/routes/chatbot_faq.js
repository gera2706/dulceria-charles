/* ============================================================
   ROUTES/CHATBOT_FAQ.JS — Dulcería Charles
   Rutas para gestionar las preguntas frecuentes del chatbot del
   sitio (ver cart.js, sección CHATBOT DEL SITIO).
   - Leer las activas: público (el chatbot las necesita en
     cualquier página, sin sesión)
   - Leer TODAS (incluye inactivas) / crear / editar / eliminar:
     solo administradores, desde el panel
============================================================ */

const router = require('express').Router();
const db     = require('../db');
const { adminMiddleware } = require('../middleware/auth');

const ACCIONES_VALIDAS = ['ninguna', 'link', 'whatsapp', 'catalogo', 'pedidos'];

/* ------------------------------------------------------------
   GET /api/chatbot-faq
   Devuelve solo las preguntas activas, ordenadas. Público: la
   consulta el chatbot del sitio en cualquier página.
------------------------------------------------------------ */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM chatbot_faq WHERE activo = 1 ORDER BY orden ASC, id ASC'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener las preguntas del chatbot.' });
  }
});

/* ------------------------------------------------------------
   GET /api/chatbot-faq/admin
   Devuelve TODAS las preguntas (activas e inactivas). Solo admins:
   la usa el panel para poder editar/reactivar las que estén ocultas.
------------------------------------------------------------ */
router.get('/admin', adminMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM chatbot_faq ORDER BY orden ASC, id ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener las preguntas del chatbot.' });
  }
});

/* Valida y normaliza los campos que vienen del formulario del admin.
   Devuelve { error } si algo es inválido, o los datos ya limpios. */
function validarDatos(body) {
  const pregunta      = (body.pregunta || '').trim();
  const respuesta      = (body.respuesta || '').trim();
  const palabras_clave = (body.palabras_clave || '').trim();
  const accion_tipo    = (body.accion_tipo || 'ninguna').trim();
  const accion_valor   = (body.accion_valor || '').trim();
  const accion_texto   = (body.accion_texto || '').trim();
  const orden          = Number.isFinite(+body.orden) ? +body.orden : 0;
  const activo         = body.activo === undefined ? 1 : (body.activo ? 1 : 0);

  if (!pregunta)  return { error: 'La pregunta es obligatoria.' };
  if (!respuesta) return { error: 'La respuesta es obligatoria.' };
  if (!ACCIONES_VALIDAS.includes(accion_tipo))
    return { error: 'Tipo de acción inválido.' };
  if (accion_tipo === 'link' && accion_valor && /^\s*(javascript|data|vbscript):/i.test(accion_valor))
    return { error: 'El link no puede usar ese esquema de URL.' };

  return { pregunta, palabras_clave, respuesta, accion_tipo, accion_valor, accion_texto, orden, activo };
}

/* ------------------------------------------------------------
   POST /api/chatbot-faq
   Crea una pregunta nueva. Solo admins.
------------------------------------------------------------ */
router.post('/', adminMiddleware, async (req, res) => {
  const datos = validarDatos(req.body);
  if (datos.error) return res.status(400).json(datos);
  try {
    const [result] = await db.query(
      `INSERT INTO chatbot_faq
         (pregunta, palabras_clave, respuesta, accion_tipo, accion_valor, accion_texto, orden, activo)
       VALUES (?,?,?,?,?,?,?,?)`,
      [datos.pregunta, datos.palabras_clave, datos.respuesta, datos.accion_tipo,
       datos.accion_valor, datos.accion_texto, datos.orden, datos.activo]
    );
    res.json(Object.assign({ id: result.insertId }, datos));
  } catch (e) {
    res.status(500).json({ error: 'Error al crear la pregunta.' });
  }
});

/* ------------------------------------------------------------
   PUT /api/chatbot-faq/:id
   Edita una pregunta existente. Solo admins.
------------------------------------------------------------ */
router.put('/:id', adminMiddleware, async (req, res) => {
  const datos = validarDatos(req.body);
  if (datos.error) return res.status(400).json(datos);
  try {
    const [existe] = await db.query('SELECT id FROM chatbot_faq WHERE id = ?', [req.params.id]);
    if (!existe.length) return res.status(404).json({ error: 'Pregunta no encontrada.' });

    await db.query(
      `UPDATE chatbot_faq SET
         pregunta=?, palabras_clave=?, respuesta=?, accion_tipo=?,
         accion_valor=?, accion_texto=?, orden=?, activo=?
       WHERE id=?`,
      [datos.pregunta, datos.palabras_clave, datos.respuesta, datos.accion_tipo,
       datos.accion_valor, datos.accion_texto, datos.orden, datos.activo, req.params.id]
    );
    res.json(Object.assign({ id: +req.params.id }, datos));
  } catch (e) {
    res.status(500).json({ error: 'Error al editar la pregunta.' });
  }
});

/* ------------------------------------------------------------
   DELETE /api/chatbot-faq/:id
   Elimina una pregunta. Solo admins.
------------------------------------------------------------ */
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const [existe] = await db.query('SELECT id FROM chatbot_faq WHERE id = ?', [req.params.id]);
    if (!existe.length) return res.status(404).json({ error: 'Pregunta no encontrada.' });

    await db.query('DELETE FROM chatbot_faq WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar la pregunta.' });
  }
});

module.exports = router;
