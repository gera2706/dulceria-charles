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

/* Escapa texto que viene de un usuario (nombre, motivo de cancelación...)
   antes de meterlo en el HTML del correo — sin esto, alguien podría
   escribir un "motivo" con etiquetas HTML y que se rendericen en el
   correo del dueño/cliente en vez de mostrarse como texto plano. */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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

/* Envía al DUEÑO (misma cuenta que manda los correos, SMTP_USER) un
   aviso de stock bajo o agotado. Dos orígenes posibles:
   - 'sistema': el backend detectó automáticamente que un producto
     cruzó el umbral (ver backend/utils/stockAlertas.js).
   - 'cliente': un cliente con un pedido incompleto avisó a propósito
     porque el producto que quería ya no está (ver
     POST /api/pedidos/:id/avisar-agotado en routes/pedidos.js).
   No lanza el error hacia arriba si falla — un correo de alerta que
   no salió no debe tumbar la venta ni el aviso del cliente; solo se
   registra en consola (ver uso en stockAlertas.js/pedidos.js). */
async function enviarAlertaStock({ nombre, stock, stockMinimo, tipo, origen, cliente, pedidoId }) {
  const transporter = getTransporter();
  const destino = process.env.SMTP_USER; // el dueño se avisa a sí mismo, misma cuenta que envía

  const esAgotado = tipo === 'agotado';
  const asunto = (esAgotado ? '🚫 Se agotó: ' : '⚠️ Stock bajo: ') + nombre;

  const nombreSeguro   = escapeHtml(nombre);
  const clienteSeguro  = escapeHtml(cliente);

  const contextoCliente = origen === 'cliente'
    ? '<p>Un cliente' + (cliente ? ' (<strong>' + clienteSeguro + '</strong>)' : '') +
      ' con un pedido pendiente' + (pedidoId ? ' (#' + pedidoId + ')' : '') +
      ' avisó que este producto ya no está disponible.</p>'
    : '<p>El sistema detectó este cambio automáticamente al procesar una venta.</p>';

  await transporter.sendMail({
    from: process.env.SMTP_FROM || ('"Dulcería Charles" <' + process.env.SMTP_USER + '>'),
    to: destino,
    subject: asunto,
    html:
      '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#333;">' +
        '<h2 style="color:#d94c85;">🍬 Dulcería Charles</h2>' +
        '<p>' + (esAgotado
          ? 'El producto <strong>' + nombreSeguro + '</strong> se quedó sin existencias (stock: 0).'
          : 'El producto <strong>' + nombreSeguro + '</strong> llegó a su nivel de stock bajo (quedan ' + stock + ', alerta configurada en ' + stockMinimo + ').') +
        '</p>' +
        contextoCliente +
        '<p style="font-size:0.85rem;color:#888;">Entra al panel de administración → Productos para revisarlo y reabastecer.</p>' +
      '</div>',
    text:
      (esAgotado
        ? 'El producto "' + nombre + '" se quedó sin existencias (stock: 0).'
        : 'El producto "' + nombre + '" llegó a su nivel de stock bajo (quedan ' + stock + ').') +
      (origen === 'cliente' ? '\n\nUn cliente avisó porque lo quería comprar y ya no está disponible.' : '') +
      '\n\nRevisa el panel de administración → Productos.'
  });
}

/* Avisa que un pedido se canceló. Sirve para las dos direcciones:
   - Cliente cancela su propio pedido → se avisa al DUEÑO (destino =
     SMTP_USER), con el motivo que escribió el cliente.
   - Admin cancela el pedido de un cliente → se avisa al CLIENTE
     (destino = su correo registrado), con el motivo que haya puesto
     el admin (opcional).
   No lanza el error hacia arriba por la misma razón que
   enviarAlertaStock: un correo que no salió no debe tumbar la
   cancelación en sí (ver uso en routes/pedidos.js). */
async function enviarAvisoCancelacion({ destino, paraCliente, pedidoId, motivo, nombreCliente }) {
  const transporter = getTransporter();

  const asunto = paraCliente
    ? '❌ Tu pedido #' + pedidoId + ' fue cancelado'
    : '❌ Pedido #' + pedidoId + ' cancelado por el cliente';

  const motivoHtml = motivo
    ? '<p><strong>Motivo:</strong> ' + escapeHtml(motivo) + '</p>'
    : '<p style="color:#888;">No se especificó un motivo.</p>';

  const cuerpoHtml = paraCliente
    ? '<p>Tu pedido <strong>#' + pedidoId + '</strong> fue cancelado por la tienda.</p>' + motivoHtml +
      '<p>Si tienes dudas, puedes escribirnos respondiendo este correo o por WhatsApp.</p>'
    : '<p>El cliente <strong>' + escapeHtml(nombreCliente || 'un cliente') + '</strong> canceló su pedido <strong>#' + pedidoId + '</strong>.</p>' + motivoHtml +
      '<p style="font-size:0.85rem;color:#888;">Si el pedido ya estaba confirmado, el stock reservado ya se devolvió al inventario automáticamente.</p>';

  await transporter.sendMail({
    from: process.env.SMTP_FROM || ('"Dulcería Charles" <' + process.env.SMTP_USER + '>'),
    to: destino,
    subject: asunto,
    html:
      '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#333;">' +
        '<h2 style="color:#d94c85;">🍬 Dulcería Charles</h2>' +
        cuerpoHtml +
      '</div>',
    text:
      (paraCliente
        ? 'Tu pedido #' + pedidoId + ' fue cancelado por la tienda.'
        : 'El cliente ' + (nombreCliente || '') + ' canceló su pedido #' + pedidoId + '.') +
      (motivo ? '\n\nMotivo: ' + motivo : '\n\nNo se especificó un motivo.')
  });
}

/* Manda al dueño el mensaje que alguien llenó en el formulario de
   Contacto del sitio (contacto.html). Antes ese formulario mandaba los
   mensajes a un formulario de Formspree de un tercero — configurado
   con el correo de quien lo haya creado en su momento, no
   necesariamente el del dueño — así que los mensajes podían estar
   llegando a otro lado sin que nadie se diera cuenta. Ahora usa el
   mismo SMTP que ya manda las demás alertas del sitio, directo al
   correo de contacto configurado en el panel admin.
   Responde-a (reply-to) es el correo de quien escribió el mensaje,
   para que baste con darle "Responder" en el correo. */
async function enviarMensajeContacto({ destino, nombre, email, telefono, asunto, mensaje }) {
  const transporter = getTransporter();

  const ASUNTOS = {
    pedido: 'Consulta sobre pedido',
    producto: 'Información de producto',
    mayoreo: 'Compra por mayoreo',
    otro: 'Otro'
  };
  const asuntoTexto = ASUNTOS[asunto] || asunto || 'Sin asunto';

  await transporter.sendMail({
    from: process.env.SMTP_FROM || ('"Dulcería Charles" <' + process.env.SMTP_USER + '>'),
    to: destino,
    replyTo: email,
    subject: '📬 Contacto: ' + asuntoTexto + ' — ' + nombre,
    html:
      '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#333;">' +
        '<h2 style="color:#d94c85;">🍬 Dulcería Charles — Nuevo mensaje de contacto</h2>' +
        '<p><strong>Nombre:</strong> ' + escapeHtml(nombre) + '</p>' +
        '<p><strong>Correo:</strong> ' + escapeHtml(email) + '</p>' +
        (telefono ? '<p><strong>Teléfono:</strong> ' + escapeHtml(telefono) + '</p>' : '') +
        '<p><strong>Asunto:</strong> ' + escapeHtml(asuntoTexto) + '</p>' +
        '<p><strong>Mensaje:</strong></p>' +
        '<p style="white-space:pre-wrap;background:#f7f2fa;padding:0.8rem 1rem;border-radius:8px;">' + escapeHtml(mensaje) + '</p>' +
        '<p style="font-size:0.85rem;color:#888;">Responde directo a este correo para contestarle a ' + escapeHtml(nombre) + '.</p>' +
      '</div>',
    text:
      'Nuevo mensaje de contacto\n\n' +
      'Nombre: ' + nombre + '\n' +
      'Correo: ' + email + '\n' +
      (telefono ? 'Teléfono: ' + telefono + '\n' : '') +
      'Asunto: ' + asuntoTexto + '\n\n' +
      mensaje
  });
}

module.exports = { enviarCorreoReseteo, enviarAlertaStock, enviarAvisoCancelacion, enviarMensajeContacto };
