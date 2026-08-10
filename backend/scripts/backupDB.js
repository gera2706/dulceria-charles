/* ================================================================
   ARCHIVO: backend/scripts/backupDB.js
   PROPÓSITO: Punto de entrada del Cron Job diario de cPanel. Ya NO
   tiene la lógica del respaldo en sí (dump/gzip/cifrado/correo) —
   eso se movió a backend/utils/backup.js, compartida con la ruta
   del botón "Generar respaldo ahora" del panel admin (ver
   backend/routes/respaldos.js). Este archivo solo hace lo que un
   script de cron necesita y la ruta del panel no: cargar el .env
   (aquí SÍ hace falta — el proceso del cron no hereda las variables
   de "Setup Node.js App" como sí las hereda la app real) y salir
   con el código de proceso correcto para que quede en backup.log.

   CÓMO SE EJECUTA (Cron Job de cPanel):
     source /home/<usuario>/nodevenv/dulceria-charles/backend/<version>/bin/activate && \
     node /home/<usuario>/dulceria-charles/backend/scripts/backupDB.js >> /home/<usuario>/backups/backup.log 2>&1

   Detalle de por qué el respaldo se cifra antes de mandarlo por
   correo (datos reales de clientes) y cómo restaurarlo: ver los
   comentarios en backend/utils/backup.js.
================================================================ */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { generarRespaldo } = require('../utils/backup');

generarRespaldo()
  .then(function (resultado) {
    if (resultado.mailed) {
      console.log('[backupDB] Respaldo generado (' + resultado.tamanoMB + 'MB), cifrado y enviado a ' + resultado.destino + '.');
    } else {
      console.warn('[backupDB] Respaldo local generado (' + resultado.tamanoMB + 'MB) pero NO se mandó por correo: ' + resultado.motivo);
    }
  })
  .catch(function (err) {
    console.error('[backupDB] Error al generar/enviar el respaldo:', err);
    process.exit(1);
  });
