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

   REESCRITO EL 14-AGO-2026: la versión anterior llamaba a los
   binarios "mysqldump" y "openssl" del sistema operativo vía
   child_process. En este hosting (CloudLinux/CageFS) ese enfoque
   dio problemas irresolubles: "mysqldump" a veces no es visible
   para el proceso de Node aunque exista en el servidor, y no hay
   forma de diagnosticarlo sin acceso a una terminal real.

   Ahora TODO el respaldo se genera en JavaScript puro, sin depender
   de ningún binario externo instalado en el servidor:
     - El dump usa el paquete npm "mysqldump" (habla directo con
       MySQL vía el mismo driver mysql2 que ya usa el resto del
       proyecto — no ejecuta ningún programa aparte).
     - El cifrado usa el módulo "crypto" incluido en Node (AES-256-CBC
       + PBKDF2-SHA256), replicando exactamente el formato de
       `openssl enc -aes-256-cbc -pbkdf2 -salt` (mismo prefijo
       "Salted__", mismos 10000 iteraciones/SHA256 por defecto) —
       así los respaldos .enc siguen restaurándose con el mismo
       comando de openssl que ya se le explica al dueño por correo,
       sin importar si ESTE servidor tiene openssl disponible o no.
     Verificado localmente: un archivo cifrado con esta función se
     descifra correctamente con `openssl enc -d -aes-256-cbc -pbkdf2
     -salt -pass pass:X -in archivo -out salida` sin cambiar nada.

   Devuelve un objeto describiendo qué pasó (no siempre lanza error:
   por ejemplo "no se pudo mandar por correo" es un resultado válido,
   no una excepción) — quien la llame decide cómo mostrarlo.
================================================================ */

const crypto   = require('crypto');
const fs       = require('fs');
const os       = require('os');
const path     = require('path');
const zlib     = require('zlib');
const mysqldump = require('mysqldump').default;

const CARPETA_RESPALDOS = path.join(os.homedir(), 'backups');
const LIMITE_DIAS = 30; // cuántos días de respaldos locales conservar
const LIMITE_MB_CORREO = 20; // por encima de esto, arriesgado que Gmail lo acepte (límite real 25MB)

/* ----------------------------------------------------------------
   cifrarComoOpenssl(buffer, password)
   Reimplementación en JS puro de:
     openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:X
   Sin -iter ni -md explícitos, así que openssl usa sus valores por
   defecto: PBKDF2 con SHA-256 y 10000 iteraciones — los mismos que
   usamos aquí para que el resultado sea 100% intercambiable con el
   comando real de openssl (probado localmente: cifrar aquí y
   descifrar con openssl real, y viceversa, da el mismo contenido).
   Formato del archivo: "Salted__" (8 bytes) + salt (8 bytes) + datos
   cifrados — es el formato estándar que openssl espera al leer.
---------------------------------------------------------------- */
function cifrarComoOpenssl(buffer, password) {
  const salt = crypto.randomBytes(8);
  const keyIv = crypto.pbkdf2Sync(password, salt, 10000, 48, 'sha256');
  const key = keyIv.subarray(0, 32);
  const iv = keyIv.subarray(32, 48);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const cifrado = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([Buffer.from('Salted__'), salt, cifrado]);
}

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
  const DB_PORT     = Number(process.env.DB_PORT) || 3306;
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

  /* ── 1. Generar el dump (JS puro, sin binario externo) ──────── */
  let dumpTexto;
  try {
    const resultado = await mysqldump({
      connection: { host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME },
      // dump.data sin formatear (format:false) es más rápido para BDs
      // grandes y no cambia el contenido, solo el espaciado del SQL.
      dump: { data: { format: false } }
    });
    dumpTexto = [resultado.dump.schema, resultado.dump.trigger, resultado.dump.data]
      .filter(Boolean)
      .join('\n\n');
  } catch (err) {
    throw new Error('No se pudo generar el dump de la base de datos: ' + err.message);
  }

  if (!dumpTexto || !dumpTexto.trim()) {
    throw new Error('El dump de la base de datos salió vacío (sin tablas o sin permisos de lectura).');
  }

  fs.writeFileSync(rutaSql, dumpTexto, 'utf8');

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
    const cifrado = cifrarComoOpenssl(fs.readFileSync(rutaGz), BACKUP_ENCRYPTION_PASSWORD);
    fs.writeFileSync(rutaEnc, cifrado);
  } catch (err) {
    return { ...resultadoBase, motivo: 'No se pudo cifrar el respaldo (' + err.message + '). Queda solo la copia local.' };
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
