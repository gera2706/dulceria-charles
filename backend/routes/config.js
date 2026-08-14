/* ============================================================
   ROUTES/CONFIG.JS — Dulcería Charles
   Rutas para la configuración del sitio.
   Los datos se guardan en la tabla "configuracion" de la BD,
   que funciona como un diccionario clave → valor.
   Ejemplo: clave="contacto_telefono", valor="+52 55 1234 5678"
============================================================ */

const router     = require('express').Router();
const db         = require('../db');
const rateLimit  = require('express-rate-limit');
const mailer     = require('../mailer');
const { adminMiddleware } = require('../middleware/auth');
const { obtenerCorreoDestino } = require('../utils/correoDestino');

// El formulario de Contacto es público (no requiere login) y cada envío
// manda un correo — sin límite, cualquiera podría usarlo para bombardear
// la bandeja del dueño. Mismo criterio que olvidePasswordLimiter en
// auth.js.
const contactoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados mensajes enviados. Espera unos minutos antes de volver a intentar.' }
});

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
    'contacto_whatsapp'
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

/* ------------------------------------------------------------
   POST /api/config/contacto-mensaje
   Recibe el formulario de la página Contacto y le manda un correo
   al dueño (al contacto_email configurado en el panel admin — el
   mismo que se muestra públicamente en la página, así que el mensaje
   siempre llega a donde el dueño dice que hay que escribirle).
   Reemplaza al formulario de Formspree que se usaba antes: ese
   dependía de un tercero configurado con el correo de quien lo haya
   creado, no necesariamente el del dueño.
   ES PÚBLICO (cualquier visitante puede escribir), pero limitado por
   contactoLimiter para que no se pueda usar para mandar spam.
   Recibe: { nombre, email, telefono?, asunto, mensaje }
------------------------------------------------------------ */
router.post('/contacto-mensaje', contactoLimiter, async (req, res) => {
  const { nombre, email, telefono, asunto, mensaje } = req.body;

  if (!nombre || !email || !mensaje)
    return res.status(400).json({ error: 'Nombre, correo y mensaje son obligatorios.' });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: 'El correo no tiene un formato válido.' });

  try {
    // obtenerCorreoDestino() ya hace exactamente esto: lee contacto_email
    // y si no existe cae en SMTP_USER — mismo helper que usan ahora las
    // alertas de stock, el aviso de cancelación al dueño y el respaldo
    // por correo (ver utils/correoDestino.js).
    const destino = await obtenerCorreoDestino();
    if (!destino) return res.status(500).json({ error: 'El sitio todavía no tiene un correo de contacto configurado.' });

    await mailer.enviarMensajeContacto({
      destino, nombre: nombre.trim(), email: email.trim(),
      telefono: telefono ? telefono.trim() : '', asunto, mensaje: mensaje.trim()
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Error al enviar mensaje de contacto:', err);
    res.status(500).json({ error: 'No se pudo enviar tu mensaje. Intenta de nuevo más tarde.' });
  }
});

module.exports = router;
