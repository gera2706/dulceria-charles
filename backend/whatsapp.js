/* ================================================================
   ARCHIVO: backend/whatsapp.js
   PROPÓSITO: Mandar alertas al DUEÑO por WhatsApp usando la API
   oficial de Meta (WhatsApp Cloud API) — canal aparte del correo
   (mailer.js); ambos quedan activos a la vez, uno no reemplaza al
   otro.

   ¿POR QUÉ SOLO AL DUEÑO Y NO TAMBIÉN A LOS CLIENTES?
   WhatsApp exige que un negocio use una "plantilla" pre-aprobada por
   Meta para escribirle primero a alguien que no le escribió antes
   (fuera de una ventana de 24h). Mandarle plantillas de aviso a un
   cliente sin su consentimiento explícito viola las políticas de
   WhatsApp Business. El dueño avisándose de su propio negocio no
   tiene ese problema — por eso esto solo se usa para el dueño.

   ¿POR QUÉ "PLANTILLA" Y NO TEXTO LIBRE?
   Mismo motivo: fuera de una conversación abierta por el destinatario
   en las últimas 24h, la API SOLO deja mandar mensajes de plantilla.
   Como el dueño nunca le "escribe primero" a su propio número de
   API, siempre hace falta una plantilla aprobada.

   VARIABLES NECESARIAS EN .env (TODAS opcionales — si falta alguna,
   simplemente no se intenta mandar el WhatsApp y el correo sigue
   funcionando normal; ver configurado() abajo):
     WHATSAPP_TOKEN            → token de acceso permanente (Meta Business → Configuración → Usuarios del sistema)
     WHATSAPP_PHONE_NUMBER_ID  → ID del número de WhatsApp Business (NO es el número en sí, es un ID largo)
     WHATSAPP_TEMPLATE_NAME    → nombre de la plantilla aprobada en WhatsApp Manager
     WHATSAPP_TO               → tu número con código de país, SIN "+", ej: 5216183007205
     WHATSAPP_LANG             → (opcional) código de idioma de la plantilla, por defecto es_MX

   CÓMO CONSEGUIR ESTOS DATOS: guía paso a paso en el mensaje donde
   se agregó este archivo (Meta for Developers → crear app tipo
   "Negocios" → producto WhatsApp → API Setup, y WhatsApp Manager →
   Plantillas de mensaje para crear la plantilla).

   LA PLANTILLA QUE ESPERA ESTE CÓDIGO: un solo parámetro de texto en
   el cuerpo, categoría "Utility". Ejemplo de cuerpo al crearla en
   Meta: "🍬 Dulcería Charles: {{1}}"
================================================================ */

const GRAPH_VERSION = 'v20.0';

function configurado() {
  return !!(
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_TEMPLATE_NAME &&
    process.env.WHATSAPP_TO
  );
}

/* Manda un WhatsApp de plantilla al dueño con un solo parámetro de
   texto (el cuerpo del aviso, ver plantilla esperada arriba). No
   lanza el error hacia arriba — mismo criterio que enviarAlertaStock/
   enviarAvisoCancelacion de mailer.js: si el WhatsApp no sale, no
   debe tumbar la venta, la cancelación ni el aviso del cliente. Si
   no está configurado, no hace nada (no truena, solo se queda callado
   — así el proyecto sigue funcionando solo con correo mientras nadie
   configure las variables de arriba). */
async function enviarWhatsAppDueno(texto) {
  if (!configurado()) return;

  try {
    const url = 'https://graph.facebook.com/' + GRAPH_VERSION + '/' + process.env.WHATSAPP_PHONE_NUMBER_ID + '/messages';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.WHATSAPP_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: process.env.WHATSAPP_TO,
        type: 'template',
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME,
          language: { code: process.env.WHATSAPP_LANG || 'es_MX' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: texto }] }
          ]
        }
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(function () { return {}; });
      console.error('Error al mandar WhatsApp (HTTP ' + res.status + '):', JSON.stringify(data));
    }
  } catch (err) {
    console.error('Error de red al mandar WhatsApp:', err);
  }
}

module.exports = { enviarWhatsAppDueno, configurado };
