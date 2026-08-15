/* ================================================================
   ARCHIVO: backend/scripts/procesarSolicitudManual.js
   PROPÓSITO: Segunda pieza del botón "Generar respaldo ahora" del
   panel admin — junto con backend/routes/respaldos.js.

   POR QUÉ EXISTE ESTE ARCHIVO (14-ago-2026): antes, el botón corría
   generarRespaldo() DENTRO del proceso de Node que atiende el sitio
   todo el tiempo (el mismo que arrancó "Setup Node.js App" de
   cPanel). El problema: en este hosting, ese proceso a veces se
   queda con código viejo cargado en memoria y NINGUNA acción desde
   cPanel (Restart, Stop+Start, hasta Destruir y Recrear la app
   completa) logra reemplazarlo de forma confiable — well documented
   ya con varios casos este mismo día (ver memoria del proyecto).

   La solución: el botón del panel YA NO ejecuta el respaldo él
   mismo. Solo dejar una "señal" (el archivo SOLICITUD_PATH) — ver
   backend/routes/respaldos.js. Este script corre por su cuenta cada
   5 minutos vía un Cron Job de cPanel NUEVO (proceso de Node
   completamente fresco en cada ejecución, arrancado por el sistema
   operativo, no por Passenger) — así que SIEMPRE lee el código
   actual del disco, sin importar qué tan atascado esté el proceso
   principal. Revisa si existe la señal; si existe, genera el
   respaldo de verdad y dejar el resultado en RESULTADO_PATH para que
   el panel lo muestre.

   Con esto, cualquier cambio futuro a la lógica del respaldo
   (backup.js) solo necesita que ESTE script corra una vez más por
   cron — nunca más depende de que el proceso principal se refresque.

   Configurar en cPanel → Cron Jobs (cada 5 minutos):
     source /home/<usuario>/nodevenv/dulceria-charles/backend/<version>/bin/activate && \
     node /home/<usuario>/dulceria-charles/backend/scripts/procesarSolicitudManual.js >> /home/<usuario>/backups/manual.log 2>&1
================================================================ */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const os = require('os');
const { generarRespaldo } = require('../utils/backup');

const CARPETA_RESPALDOS = path.join(os.homedir(), 'backups');
const SOLICITUD_PATH  = path.join(CARPETA_RESPALDOS, '.solicitud-manual');
const RESULTADO_PATH  = path.join(CARPETA_RESPALDOS, '.ultimo-resultado-manual.json');

(async () => {
  if (!fs.existsSync(SOLICITUD_PATH)) {
    // Caso normal en la gran mayoría de las ejecuciones (cron corre
    // cada 5 min pero el dueño rara vez toca el botón): no hay
    // nada que hacer, salir rápido y barato.
    process.exit(0);
  }

  // Borrar la señal ANTES de generar el respaldo (no después): si el
  // respaldo tarda más que el intervalo del cron y una segunda
  // ejecución arranca en paralelo, esta segunda ya no encuentra la
  // señal y no duplica el trabajo.
  fs.unlinkSync(SOLICITUD_PATH);

  const escribirResultado = (obj) => {
    fs.writeFileSync(RESULTADO_PATH, JSON.stringify({ ...obj, procesadoEn: new Date().toISOString() }, null, 2));
  };

  try {
    const resultado = await generarRespaldo();
    escribirResultado({ ok: true, resultado });
    console.log('[procesarSolicitudManual] Respaldo manual generado:', JSON.stringify(resultado));
  } catch (err) {
    escribirResultado({ ok: false, error: err.message });
    console.error('[procesarSolicitudManual] Error al generar el respaldo manual:', err);
  }

  process.exit(0);
})();
