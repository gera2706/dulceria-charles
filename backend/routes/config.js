/* ============================================================
   ROUTES/CONFIG.JS — Dulcería Charles
   Rutas para la configuración del sitio.
   Los datos se guardan en la tabla "configuracion" de la BD,
   que funciona como un diccionario clave → valor.
   Ejemplo: clave="contacto_telefono", valor="+52 55 1234 5678"
============================================================ */

const router = require('express').Router();
const db     = require('../db');
const { adminMiddleware } = require('../middleware/auth');

/* ------------------------------------------------------------
   GET /api/config/contacto
   Devuelve toda la información de contacto del sitio.
   ES PÚBLICO: cualquiera puede verlo (se muestra en la página
   de contacto). No requiere estar logueado.
   Devuelve: { contacto_telefono: "...", contacto_email: "...", ... }
------------------------------------------------------------ */
router.get('/contacto', async (req, res) => {
  try {
    // Traemos todas las filas cuya clave empiece con "contacto_"
    const [rows] = await db.query(
      "SELECT clave, valor FROM configuracion WHERE clave LIKE 'contacto_%'"
    );

    // Convertimos el array [{clave, valor}, ...] en un objeto plano
    // para que el frontend pueda acceder directo: config.contacto_telefono
    const config = {};
    rows.forEach(r => { config[r.clave] = r.valor; });

    res.json(config);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener configuración.' });
  }
});

/* ------------------------------------------------------------
   PUT /api/config/contacto
   Guarda (o actualiza) la información de contacto. Solo admins.
   Usa "INSERT ... ON DUPLICATE KEY UPDATE" que significa:
   "si ya existe esta clave → actualiza el valor,
    si no existe → crea una fila nueva"
   Recibe: objeto con los campos a guardar
------------------------------------------------------------ */
router.put('/contacto', adminMiddleware, async (req, res) => {
  // Lista completa de campos permitidos para actualizar
  const campos = [
    'contacto_direccion',
    'contacto_ciudad',
    'contacto_horario',
    'contacto_telefono',
    'contacto_email',
    'contacto_instagram',
    'contacto_facebook',
    'contacto_whatsapp',
    'contacto_twitter'
  ];
  try {
    // Guardamos cada campo si viene en la petición
    for (const clave of campos) {
      if (req.body[clave] !== undefined) {
        await db.query(
          'INSERT INTO configuracion (clave, valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor=?',
          [clave, req.body[clave], req.body[clave]]
        );
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al guardar configuración.' });
  }
});

module.exports = router;
