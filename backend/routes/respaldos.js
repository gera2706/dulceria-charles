/* ================================================================
   ARCHIVO: backend/routes/respaldos.js
   PROPÓSITO: Panel admin → sección "Respaldos". Deja al dueño
   generar un respaldo de la base de datos AHORA MISMO (dump +
   gzip + cifrado + correo), sin esperar al Cron Job diario de
   cPanel (ver backend/scripts/backupDB.js, corre solo a las 10:28).

   La lógica real vive en backend/utils/backup.js, compartida con
   el script de cron — aquí solo se agregan dos cosas propias de un
   botón en un panel web:

   1. adminMiddleware — mismo login que el resto del panel.
   2. Un "cooldown": el dump de mysqldump usa CPU/disco real, así
      que no tiene sentido dejar generar uno nuevo cada pocos
      segundos (por un doble clic accidental, por ejemplo). Se
      guarda en memoria el momento del último respaldo manual —
      alcanza para esto porque la app corre en un solo proceso.
================================================================ */

const router = require('express').Router();
const { adminMiddleware } = require('../middleware/auth');
const { generarRespaldo, ultimoRespaldoLocal } = require('../utils/backup');

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos entre respaldos manuales
let ultimoRespaldoManualMs = 0;

/* ----------------------------------------------------------------
   GET /api/respaldos
   Info del último respaldo local que exista en el servidor (lo haya
   generado el cron o un clic manual) — para que la sección no se
   vea vacía antes de tocar el botón.
---------------------------------------------------------------- */
router.get('/', adminMiddleware, async (req, res) => {
  try {
    res.json({ ultimo: ultimoRespaldoLocal() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer el estado de los respaldos.' });
  }
});

/* ----------------------------------------------------------------
   POST /api/respaldos
   Genera un respaldo ahora mismo. Usa la versión asíncrona de
   generarRespaldo() (ver backup.js) — corre DENTRO del proceso que
   atiende a los clientes, así que si fuera bloqueante congelaría el
   sitio mientras dura el dump. Con execFile async no pasa: el resto
   de peticiones al servidor se siguen atendiendo mientras esta
   corre en segundo plano dentro del event loop.
---------------------------------------------------------------- */
router.post('/', adminMiddleware, async (req, res) => {
  const faltan = COOLDOWN_MS - (Date.now() - ultimoRespaldoManualMs);
  if (faltan > 0) {
    return res.status(429).json({ error: 'Espera ' + Math.ceil(faltan / 60000) + ' minuto(s) antes de generar otro respaldo manual.' });
  }
  ultimoRespaldoManualMs = Date.now();

  try {
    const resultado = await generarRespaldo();
    res.json(resultado);
  } catch (err) {
    console.error('[respaldos] Error al generar respaldo manual:', err);
    res.status(500).json({ error: 'No se pudo generar el respaldo: ' + err.message });
  }
});

module.exports = router;
