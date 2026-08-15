/* ================================================================
   ARCHIVO: backend/routes/respaldos.js
   PROPÓSITO: Panel admin → sección "Respaldos". Deja al dueño pedir
   un respaldo de la base de datos AHORA MISMO, sin esperar al Cron
   Job diario de cPanel (ver backend/scripts/backupDB.js).

   REESCRITO EL 14-ago-2026: este handler YA NO genera el respaldo
   él mismo. Antes llamaba a generarRespaldo() directo, corriendo
   dentro del proceso de Node que atiende el sitio todo el tiempo —
   pero en este hosting ese proceso puede quedarse con código viejo
   cargado en memoria sin que ninguna acción de cPanel lo reemplace
   (bug de infraestructura, no de este código — pasó varias veces el
   mismo día con rutas que no tienen nada que ver entre sí).

   Ahora el botón solo deja una señal (un archivo) y responde de
   inmediato. Un Cron Job aparte —backend/scripts/
   procesarSolicitudManual.js, corre cada 5 minutos como proceso
   de Node completamente nuevo cada vez— es quien de verdad genera
   el respaldo, leyendo siempre el código actual del disco. El panel
   admin hace polling a GET /api/respaldos hasta que la señal
   desaparece y hay un resultado nuevo (ver public/js/admin.js).
================================================================ */

const router = require('express').Router();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { adminMiddleware } = require('../middleware/auth');
const { ultimoRespaldoLocal } = require('../utils/backup');

const CARPETA_RESPALDOS = path.join(os.homedir(), 'backups');
const SOLICITUD_PATH  = path.join(CARPETA_RESPALDOS, '.solicitud-manual');
const RESULTADO_PATH  = path.join(CARPETA_RESPALDOS, '.ultimo-resultado-manual.json');

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos entre respaldos manuales
let ultimaSolicitudMs = 0;

/* ----------------------------------------------------------------
   GET /api/respaldos
   Devuelve tres cosas para que el panel sepa qué mostrar:
   - ultimo: info del respaldo local más reciente (lo haya generado
     el cron diario o una solicitud manual).
   - enCurso: true si hay una solicitud manual todavía sin procesar
     (el archivo de señal existe — el Cron Job de 5 min aún no
     pasó, o el dueño acaba de tocar el botón).
   - ultimoResultadoManual: el resultado (éxito o error) de la
     última solicitud manual que SÍ se procesó, para mostrarlo una
     vez que enCurso pase a false.
---------------------------------------------------------------- */
router.get('/', adminMiddleware, async (req, res) => {
  try {
    let ultimoResultadoManual = null;
    if (fs.existsSync(RESULTADO_PATH)) {
      try {
        ultimoResultadoManual = JSON.parse(fs.readFileSync(RESULTADO_PATH, 'utf8'));
      } catch (e) {
        // Archivo corrupto/a medio escribir — no tumbar la respuesta por esto.
        ultimoResultadoManual = null;
      }
    }
    res.json({
      ultimo: ultimoRespaldoLocal(),
      enCurso: fs.existsSync(SOLICITUD_PATH),
      ultimoResultadoManual
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer el estado de los respaldos.' });
  }
});

/* ----------------------------------------------------------------
   POST /api/respaldos
   Deja la señal para que el Cron Job de procesarSolicitudManual.js
   la recoja en su próxima pasada (máximo 5 minutos de espera).
   No genera nada aquí mismo — por diseño, ver encabezado del
   archivo.
---------------------------------------------------------------- */
router.post('/', adminMiddleware, async (req, res) => {
  const faltan = COOLDOWN_MS - (Date.now() - ultimaSolicitudMs);
  if (faltan > 0) {
    return res.status(429).json({ error: 'Espera ' + Math.ceil(faltan / 60000) + ' minuto(s) antes de pedir otro respaldo manual.' });
  }
  ultimaSolicitudMs = Date.now();

  try {
    fs.mkdirSync(CARPETA_RESPALDOS, { recursive: true });
    fs.writeFileSync(SOLICITUD_PATH, JSON.stringify({ solicitadoEn: new Date().toISOString() }));
    res.json({ ok: true, enCurso: true, mensaje: 'Respaldo solicitado — puede tardar unos minutos en generarse.' });
  } catch (err) {
    console.error('[respaldos] Error al dejar la solicitud manual:', err);
    res.status(500).json({ error: 'No se pudo registrar la solicitud de respaldo: ' + err.message });
  }
});

module.exports = router;
