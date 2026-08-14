/* ================================================================
   ARCHIVO: backend/utils/correoDestino.js
   PROPÓSITO: Un solo lugar para resolver "¿a qué correo le mando
   esto?" para todo lo que antes iba fijo a process.env.SMTP_USER
   (alertas de stock, aviso de cancelación al dueño, respaldo por
   correo). Ahora usan el mismo contacto_email que se edita en
   Configuración del sitio — así cambiarlo ahí mueve TODO de un jalón,
   en vez de tener que acordarse de también cambiar la variable de
   entorno SMTP_USER en cPanel.

   Por qué sigue existiendo el fallback a SMTP_USER: si todavía no se
   ha guardado nunca un contacto_email (sitio recién instalado, tabla
   configuracion vacía), no queremos que las alertas se queden sin
   destino — mejor que lleguen a la misma cuenta que las envía que no
   que se pierdan en silencio.
================================================================ */

const db = require('../db');

/* conn opcional: si quien llama ya tiene una conexión/transacción
   abierta (ver conActor en db.js), se la puede pasar para reusarla en
   vez de pedir una nueva del pool. Si no, usa el pool directo. */
async function obtenerCorreoDestino(conn) {
  try {
    const ejecutor = conn || db;
    const [rows] = await ejecutor.query(
      "SELECT valor FROM configuracion WHERE clave = 'contacto_email'"
    );
    return (rows[0] && rows[0].valor) || process.env.SMTP_USER || null;
  } catch (err) {
    // Si la tabla configuracion no existiera todavía (instalación
    // viejita sin migrar) o la consulta fallara por lo que sea, no
    // debe tumbar el envío de la alerta — solo se cae al de siempre.
    console.error('No se pudo leer contacto_email de configuracion, usando SMTP_USER:', err.message);
    return process.env.SMTP_USER || null;
  }
}

module.exports = { obtenerCorreoDestino };
