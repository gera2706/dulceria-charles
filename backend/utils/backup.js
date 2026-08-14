/* ================================================================
   ARCHIVO: backend/utils/backup.js
   PROPÓSITO: Lógica REAL de generar un respaldo de la base de datos
   (dump + gzip + cifrado + correo). Vive aquí, separada, porque la
   usan DOS cosas distintas:

     1. backend/scripts/backupDB.js — el Cron Job diario de cPanel,
        corre como proceso aparte (no bloquea nada aunque tarde).

     2. backend/routes/respaldos.js — el botón "Generar respaldo
        ahora" del panel admin, que corre DENTRO del mismo proceso
        de Node que atiende a los clientes de la tienda.

   ¿POR QUÉ NO SE PUEDE REUSAR TAL CUAL EL CÓDIGO VIEJO DE
   backupDB.js? Ese usaba execFileSync (versión SÍNCRONA/bloqueante)
   de mysqldump/openssl — para un script aparte no importa, pero si
   el panel admin llamara esa misma función, congelaría el sitio
   ENTERO (nadie podría cargar el catálogo ni pagar) mientras dura
   el dump. Aquí se usa la versión asíncrona (execFile + promisify)
   para que, sin importar quién la llame, nunca bloquee el event
   loop — mientras se genera el respaldo, el resto de peticiones al
   servidor se siguen atendiendo normal.

   Devuelve un objeto describiendo qué pasó (no siempre lanza error:
   por ejemplo "no se pudo mandar por correo" es un resultado válido,
   no una excepción) — quien la llame decide cómo mostrarlo.
================================================================ */

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const zlib = require('zlib');

const execFileAsync = promisify(execFile);

const CARPETA_RESPALDOS = path.join(os.homedir(), 'backups');
const LIMITE_DIAS = 30; // cuántos días de respaldos locales conservar
const LIMITE_MB_CORREO = 20; // por encima de esto, arriesgado que Gmail lo acepte (límite real 25MB)

/* ----------------------------------------------------------------
   generarRespaldo()
   Hace TODO el proceso: dump → gzip → limpia viejos → cifra → manda
   por correo. Lee la configuración de process.env en cada llamada
   (no al cargar el archivo), así sirve igual para el script de cron
   (que carga dotenv antes de llamarla) que para la app real (que ya
   tiene las variables inyectadas por "Setup Node.js App" de cPanel).
---------------------------------------------------------------- */
async function generarRespaldo() {
  const mailer = require('../mailer'); // require tardío: mailer.js también depende de process.env ya cargado
  const { obtenerCorreoDestino } = require('./correoDestino'); // ídem: usa db.js, que lee process.env al cargar

  const DB_HOST     = process.env.DB_HOST || 'localhost';
  const DB_PORT     = process.env.DB_PORT || 3306;
  const DB_USER     = process.env.DB_USER;
  const DB_PASSWORD = process.env.DB_PASSWORD || '';
  const DB_NAME     = process.env.DB_NAME;
  // BACKUP_EMAIL sigue siendo un override específico por si el dueño
  // quiere que el respaldo (distinto de las alertas normales) vaya a
  // otra cuenta — pero si no está puesto, ahora cae en el mismo
  // contacto_email de Configuración en vez de saltar directo a
  // SMTP_USER, para que un solo cambio ahí mueva todo lo demás.
  const DESTINO     = process.env.BACKUP_EMAIL || await obtenerCorreoDestino();
  const BACKUP_ENCRYPTION_PASSWORD = process.env.BACKUP_ENCRYPTION_PASSWORD;

  if (!DB_USER || !DB_NAME) {
    throw new Error('Faltan DB_USER/DB_NAME en las variables de entorno.');
  }

  const fechaISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const nombreBase = 'dulceria_charles_' + fechaISO;

  fs.mkdirSync(CARPETA_RESPALDOS, { recursive: true });
  const rutaSql = path.join(CARPETA_RESPALDOS, nombreBase + '.sql');
  const rutaGz  = rutaSql + '.gz';

  /* ── 1. Generar el dump con mysqldump (asíncrono) ───────────
     --defaults-extra-file en vez de "-p..." directo: un "-p" en la
     línea de comandos queda visible en "ps aux" mientras corre. */
  const rutaCnfTemp = path.join(os.tmpdir(), 'dcbackup_' + process.pid + '_' + Date.now() + '.cnf');
  fs.writeFileSync(
    rutaCnfTemp,
    '[client]\nuser=' + DB_USER + '\npassword=' + DB_PASSWORD + '\nhost=' + DB_HOST + '\nport=' + DB_PORT + '\n',
    { mode: 0o600 }
  );

  let dump;
  try {
    const resultado = await execFileAsync('mysqldump', [
      '--defaults-extra-file=' + rutaCnfTemp,
      '--single-transaction', // no bloquea las tablas mientras se lee
      '--routines',
      '--triggers',
      DB_NAME
    ], { maxBuffer: 1024 * 1024 * 200, encoding: 'buffer' });
    dump = resultado.stdout;
  } finally {
    fs.unlinkSync(rutaCnfTemp);
  }

  fs.writeFileSync(rutaSql, dump);

  /* ── 2. Comprimir (gzip) ──────────────────────────────────── */
  const gzBuffer = zlib.gzipSync(fs.readFileSync(rutaSql));
  fs.writeFileSync(rutaGz, gzBuffer);
  fs.unlinkSync(rutaSql);

  /* ── 3. Borrar respaldos locales de más de LIMITE_DIAS ────── */
  const ahoraMs = Date.now();
  for (const archivo of fs.readdirSync(CARPETA_RESPALDOS)) {
    if (!archivo.endsWith('.sql.gz')) continue;
    const rutaArchivo = path.join(CARPETA_RESPALDOS, archivo);
    const edadDias = (ahoraMs - fs.statSync(rutaArchivo).mtimeMs) / (1000 * 60 * 60 * 24);
    if (edadDias > LIMITE_DIAS) fs.unlinkSync(rutaArchivo);
  }

  const tamanoMB = gzBuffer.length / (1024 * 1024);
  const resultadoBase = { archivo: nombreBase + '.sql.gz', tamanoMB: Number(tamanoMB.toFixed(2)), mailed: false, destino: DESTINO || null };

  /* ── 4. Mandar por correo (opcional, con sus propios "no" válidos) ── */
  if (!DESTINO) {
    return { ...resultadoBase, motivo: 'No hay BACKUP_EMAIL ni SMTP_USER configurado — se guardó el respaldo local pero no se mandó copia por correo.' };
  }
  if (tamanoMB > LIMITE_MB_CORREO) {
    return { ...resultadoBase, motivo: 'El respaldo pesa ' + resultadoBase.tamanoMB + 'MB, por encima del límite de adjuntos de Gmail. Queda solo la copia local.' };
  }
  if (!BACKUP_ENCRYPTION_PASSWORD) {
    return { ...resultadoBase, motivo: 'Falta BACKUP_ENCRYPTION_PASSWORD — nunca se manda el respaldo sin cifrar. Queda solo la copia local.' };
  }

  const rutaEnc = rutaGz + '.enc';
  try {
    await execFileAsync('openssl', [
      'enc', '-aes-256-cbc', '-pbkdf2', '-salt',
      '-pass', 'env:BACKUP_ENCRYPTION_PASSWORD',
      '-in', rutaGz,
      '-out', rutaEnc
    ]);
  } catch (err) {
    return { ...resultadoBase, motivo: 'No se pudo cifrar el respaldo con openssl (' + err.message + '). Queda solo la copia local.' };
  }

  try {
    await mailer.enviarRespaldoBD(DESTINO, rutaEnc, nombreBase + '.sql.gz.enc', fechaISO);
  } catch (err) {
    return { ...resultadoBase, motivo: 'El respaldo se cifró pero el correo falló al enviarse (' + err.message + '). Queda solo la copia local.' };
  } finally {
    fs.unlinkSync(rutaEnc);
  }

  return { ...resultadoBase, mailed: true, archivo: nombreBase + '.sql.gz.enc' };
}

/* ----------------------------------------------------------------
   ultimoRespaldoLocal()
   Info del respaldo local más reciente (para mostrar "último
   respaldo: ..." en el panel admin sin tener que generar uno
   nuevo). Null si nunca se ha generado ninguno en este servidor.
---------------------------------------------------------------- */
function ultimoRespaldoLocal() {
  if (!fs.existsSync(CARPETA_RESPALDOS)) return null;
  const archivos = fs.readdirSync(CARPETA_RESPALDOS)
    .filter(function (f) { return f.endsWith('.sql.gz'); })
    .map(function (f) {
      const stat = fs.statSync(path.join(CARPETA_RESPALDOS, f));
      return { nombre: f, tamanoMB: Number((stat.size / (1024 * 1024)).toFixed(2)), fecha: stat.mtime };
    })
    .sort(function (a, b) { return b.fecha - a.fecha; });
  return archivos[0] || null;
}

module.exports = { generarRespaldo, ultimoRespaldoLocal };
