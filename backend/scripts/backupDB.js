/* ================================================================
   ARCHIVO: backend/scripts/backupDB.js
   PROPÓSITO: Generar un respaldo (dump) de la base de datos y
   guardarlo en DOS lugares, no uno:

     1. Localmente en el servidor (misma carpeta que ya se usaba,
        ~/backups/) — copia rápida, sirve para restaurar al instante
        sin depender de nada más.

     2. Por correo, como adjunto comprimido, a la cuenta del dueño
        (ver BACKUP_EMAIL/SMTP_USER más abajo) — la copia "fuera del
        hosting". Si Namecheap llegara a fallar por completo (la
        cuenta, el servidor, lo que sea), la copia local se pierde
        con todo lo demás — pero la que ya está en Gmail sigue viva,
        porque es infraestructura de Google, no de Namecheap.

   ANTES: el Cron Job de cPanel corría "mysqldump ... > archivo.sql"
   directo (ver memoria db-backup-cron). Esto guardaba SOLO la copia
   local (punto 1) — si fallaba el hosting completo, no había nada
   fuera de ahí. Este script reemplaza ese comando y hace ambas cosas.

   CÓMO SE EJECUTA (Cron Job de cPanel, en vez del mysqldump directo):
     source /home/<usuario>/nodevenv/dulceria-charles/backend/<version>/bin/activate && \
     node /home/<usuario>/dulceria-charles/backend/scripts/backupDB.js >> /home/<usuario>/backups/backup.log 2>&1
   (el "source .../activate" hace falta para que "node" y los paquetes
   de npm —nodemailer— estén disponibles; es el mismo virtualenv que
   ya usa la app real, cPanel lo crea solo al hacer "Setup Node.js App").

   REQUISITOS: ninguno nuevo. Usa las mismas variables de entorno que
   ya tiene el resto del backend en el .env de producción
   (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME, SMTP_*), y el binario
   "mysqldump", que siempre está instalado junto con MySQL en cPanel.
================================================================ */

const { execFileSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const zlib = require('zlib');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mailer = require('../mailer');

const DB_HOST     = process.env.DB_HOST || 'localhost';
const DB_PORT     = process.env.DB_PORT || 3306;
const DB_USER     = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME     = process.env.DB_NAME;

// A quién le llega la copia por correo. BACKUP_EMAIL es opcional —
// si no se define, cae en SMTP_USER (la misma cuenta que ya manda
// todos los demás correos del sitio, ver memoria admin-smtp-account).
const DESTINO = process.env.BACKUP_EMAIL || process.env.SMTP_USER;

const CARPETA_RESPALDOS = path.join(os.homedir(), 'backups');
const LIMITE_DIAS = 30; // cuántos días de respaldos locales conservar

async function main() {
  if (!DB_USER || !DB_NAME) {
    console.error('[backupDB] Faltan DB_USER/DB_NAME en el .env — abortando.');
    process.exit(1);
  }

  const fechaISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const nombreBase = 'dulceria_charles_' + fechaISO;

  fs.mkdirSync(CARPETA_RESPALDOS, { recursive: true });
  const rutaSql = path.join(CARPETA_RESPALDOS, nombreBase + '.sql');
  const rutaGz  = rutaSql + '.gz';

  /* ── 1. Generar el dump con mysqldump ──────────────────────
     Usamos --defaults-extra-file en vez de pasar la contraseña como
     "-p..." directo en el comando: un "-p" en la línea de comandos
     queda visible en la lista de procesos del servidor (ps aux)
     mientras el comando corre. Con un archivo temporal de config
     (borrado inmediatamente después, y creado con permisos 600 —
     solo el dueño del archivo puede leerlo) la contraseña nunca
     queda expuesta ahí. */
  const rutaCnfTemp = path.join(os.tmpdir(), 'dcbackup_' + process.pid + '.cnf');
  fs.writeFileSync(
    rutaCnfTemp,
    '[client]\nuser=' + DB_USER + '\npassword=' + DB_PASSWORD + '\nhost=' + DB_HOST + '\nport=' + DB_PORT + '\n',
    { mode: 0o600 }
  );

  let dump;
  try {
    dump = execFileSync('mysqldump', [
      '--defaults-extra-file=' + rutaCnfTemp,
      '--single-transaction', // no bloquea las tablas mientras se lee — el sitio sigue funcionando normal durante el respaldo
      '--routines',
      '--triggers',
      DB_NAME
    ], { maxBuffer: 1024 * 1024 * 200 }); // hasta 200MB de dump, de sobra para esta BD
  } finally {
    fs.unlinkSync(rutaCnfTemp); // el archivo con la contraseña no debe sobrevivir al script
  }

  fs.writeFileSync(rutaSql, dump);

  /* ── 2. Comprimir (gzip) ────────────────────────────────────
     Un dump de texto plano (SQL repetitivo) comprime muy bien. Esto
     reduce el espacio en disco Y el tamaño del adjunto de correo,
     que tiene límite (Gmail acepta hasta ~25MB). */
  const gzBuffer = zlib.gzipSync(fs.readFileSync(rutaSql));
  fs.writeFileSync(rutaGz, gzBuffer);
  fs.unlinkSync(rutaSql); // ya no hace falta el .sql sin comprimir

  /* ── 3. Borrar respaldos locales de más de LIMITE_DIAS ──────
     Sin esto, la carpeta de respaldos crecería para siempre y algún
     día llenaría la cuota de disco del hosting. */
  const ahoraMs = Date.now();
  for (const archivo of fs.readdirSync(CARPETA_RESPALDOS)) {
    if (!archivo.endsWith('.sql.gz')) continue;
    const rutaArchivo = path.join(CARPETA_RESPALDOS, archivo);
    const edadDias = (ahoraMs - fs.statSync(rutaArchivo).mtimeMs) / (1000 * 60 * 60 * 24);
    if (edadDias > LIMITE_DIAS) fs.unlinkSync(rutaArchivo);
  }

  /* ── 4. Mandar la copia "fuera del hosting" por correo ──────── */
  if (!DESTINO) {
    console.warn('[backupDB] No hay BACKUP_EMAIL ni SMTP_USER configurado — se guardó el respaldo local pero NO se mandó copia por correo. Sigue habiendo un único punto de falla.');
    return;
  }

  const tamañoMB = (gzBuffer.length / (1024 * 1024)).toFixed(2);
  if (gzBuffer.length > 20 * 1024 * 1024) {
    // Por encima de ~20MB es arriesgado que Gmail lo acepte (límite
    // real 25MB, dejamos margen). Mejor avisar por log que fallar
    // en silencio o que el correo rebote sin que nadie se entere.
    console.warn('[backupDB] El respaldo comprimido pesa ' + tamañoMB + 'MB, cerca o por encima del límite de adjuntos de Gmail. No se mandó por correo; queda solo la copia local en ' + rutaGz + '. Si esto empieza a pasar seguido, hay que cambiar a otro método de envío (ej. subirlo a Drive en vez de adjuntarlo).');
    return;
  }

  await mailer.enviarRespaldoBD(DESTINO, rutaGz, nombreBase + '.sql.gz', fechaISO);
  console.log('[backupDB] Respaldo generado (' + tamañoMB + 'MB) y enviado a ' + DESTINO + '.');
}

main().catch(function (err) {
  console.error('[backupDB] Error al generar/enviar el respaldo:', err);
  process.exit(1);
});
