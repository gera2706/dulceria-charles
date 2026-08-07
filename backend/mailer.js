/* ================================================================
   ARCHIVO: backend/mailer.js
   PROPÓSITO: Enviar correos reales desde el servidor (por ahora,
   solo el de recuperación de contraseña). Usa nodemailer con un
   servidor SMTP configurado por variables de entorno, así que
   funciona con cualquier proveedor (Gmail, Outlook, un hosting de
   correo propio, etc.) sin cambiar código, solo el .env.

   VARIABLES NECESARIAS EN .env:
     SMTP_HOST      → ej. smtp.gmail.com
     SMTP_PORT      → 587 (STARTTLS, lo normal) o 465 (SSL directo)
     SMTP_USER      → la cuenta de correo que envía
     SMTP_PASSWORD  → su contraseña de aplicación (NO la contraseña
                       normal de la cuenta — ver guía abajo)
     SMTP_FROM      → (opcional) remitente que ve el cliente,
                       ej. '"Dulcería Charles" <hola@dulceriacharles.com>'

   CÓMO CONSEGUIR UNA "CONTRASEÑA DE APLICACIÓN" DE GMAIL:
   Gmail no deja usar la contraseña normal de la cuenta para esto
   (por seguridad). Hay que generar una específica:
   1. Activa la verificación en 2 pasos en myaccount.google.com/security
      (Gmail exige esto antes de dejarte crear contraseñas de app).
   2. Ve a myaccount.google.com/apppasswords
   3. Crea una nueva, ponle un nombre como "Dulceria Charles" y copia
      los 16 caracteres que te da — esa es tu SMTP_PASSWORD.
   4. SMTP_USER es tu correo normal de Gmail, SMTP_HOST=smtp.gmail.com,
      SMTP_PORT=587.
================================================================ */

const nodemailer = require('nodemailer');

let _transporter = null;

/* Reusamos un solo transporter para todo el proceso, en vez de crear
   uno nuevo por cada correo (más rápido, y nodemailer ya maneja el
   pool de conexiones SMTP internamente). */
function getTransporter() {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +(process.env.SMTP_PORT || 587),
    secure: +(process.env.SMTP_PORT || 587) === 465, // true solo si el puerto es 465 (SSL directo)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  return _transporter;
}

/* Envía el correo con el link para restablecer la contraseña.
   Lanza el error hacia arriba si falla — quien lo llame decide
   qué tan grave es (ver uso en routes/auth.js). */
async function enviarCorreoReseteo(destino, nombre, linkReseteo) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || ('"Dulcería Charles" <' + process.env.SMTP_USER + '>'),
    to: destino,
    subject: '🍬 Recupera tu contraseña — Dulcería Charles',
    html:
      '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#333;">' +
        '<h2 style="color:#d94c85;">🍬 Dulcería Charles</h2>' +
        '<p>Hola ' + nombre + ',</p>' +
        '<p>Recibimos una solicitud para restablecer tu contraseña. Si no fuiste tú, puedes ignorar este correo — tu contraseña actual sigue funcionando normalmente.</p>' +
        '<p style="margin:1.5rem 0;">' +
          '<a href="' + linkReseteo + '" style="background:#d94c85;color:#fff;padding:0.7rem 1.4rem;border-radius:50px;text-decoration:none;display:inline-block;font-weight:bold;">Restablecer contraseña</a>' +
        '</p>' +
        '<p style="font-size:0.85rem;color:#888;">Este link expira en 1 hora. Si el botón no funciona, copia y pega esta dirección en tu navegador:<br>' + linkReseteo + '</p>' +
      '</div>',
    text:
      'Hola ' + nombre + ',\n\n' +
      'Recibimos una solicitud para restablecer tu contraseña de Dulcería Charles.\n' +
      'Si no fuiste tú, ignora este correo.\n\n' +
      'Restablece tu contraseña aquí (válido por 1 hora):\n' + linkReseteo
  });
}

module.exports = { enviarCorreoReseteo };
