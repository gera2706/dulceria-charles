/* ================================================================
   ARCHIVO: backend/db.js
   PROPÓSITO: Crear y exportar la conexión a la base de datos MySQL.

   ¿POR QUÉ EXISTE ESTE ARCHIVO SEPARADO?
   Porque muchos archivos del backend necesitan hablar con la base
   de datos (productos, pedidos, usuarios, etc.). En lugar de
   escribir la configuración de conexión en CADA uno de esos
   archivos, la escribimos UNA sola vez aquí y los demás la
   importan con: const db = require('../db');

   ¿QUÉ ES UN "POOL" DE CONEXIONES?
   Imagina que la base de datos es una oficina y las conexiones
   son empleados que van a buscar información.
   - Sin pool: cada vez que alguien pide algo, contratas y despides
     un empleado → lento y costoso.
   - Con pool: tienes 10 empleados fijos listos para trabajar.
     Cuando llega una petición, uno de ellos la atiende y cuando
     termina queda libre para la siguiente → mucho más eficiente.
================================================================ */

const mysql = require('mysql2/promise');
// mysql2/promise es la librería que nos permite conectarnos a MySQL
// La parte "/promise" significa que podemos usar async/await en lugar
// de callbacks (forma más moderna y legible de escribir código asíncrono)

require('dotenv').config();
// dotenv lee el archivo .env y carga sus variables para que estén
// disponibles en process.env. Sin esta línea, process.env.DB_HOST
// sería undefined y la conexión fallaría.

const pool = mysql.createPool({
  // Leemos cada dato de configuración desde el .env
  // El || (OR) es un valor por defecto si la variable no está definida
  host:     process.env.DB_HOST     || 'localhost', // ¿Dónde está el servidor MySQL? (casi siempre localhost en desarrollo)
  port:     process.env.DB_PORT     || 3306,        // Puerto de MySQL. 3306 es el estándar, como el 80 para HTTP
  user:     process.env.DB_USER     || 'root',      // Usuario de MySQL con el que entramos
  password: process.env.DB_PASSWORD || '',          // Contraseña de ese usuario
  database: process.env.DB_NAME     || 'dulceria_charles', // Nombre de la base de datos que usaremos

  waitForConnections: true,
  // Si los 10 empleados están ocupados y llega una petición nueva,
  // ¿qué hacemos? Con true: la ponemos en cola hasta que uno quede libre.
  // Con false: lanzaría un error inmediato.

  connectionLimit: 10,
  // Máximo de conexiones simultáneas permitidas. 10 es suficiente
  // para una tienda pequeña. Sitios grandes usan 100 o más.

  charset: 'utf8mb4'
  // Codificación de caracteres. utf8mb4 soporta prácticamente todos
  // los idiomas del mundo Y emojis. El utf8 estándar de MySQL NO
  // soporta emojis, por eso usamos mb4 (multi-byte 4).
});

/* ----------------------------------------------------------------
   conActor(actorLabel, fn) — para que la auditoría sepa QUIÉN hizo
   un cambio, no solo QUÉ cambió.

   Los 8 triggers de auditoria (ver dulceria_charles_hosting.sql)
   escriben solos una fila en `auditoria` cada vez que se hace un
   INSERT/UPDATE/DELETE en productos, pedidos o usuarios — pero un
   trigger de MySQL no tiene forma de saber qué admin de la página
   disparó ese cambio: todos los admins comparten la misma cuenta de
   conexión a la base de datos. La única forma de "avisarle" al
   trigger quién es el actor real es dejarle una pista en la MISMA
   conexión justo antes de la consulta, con una variable de sesión:
   SET @app_usuario = 'Gera (gera@ejemplo.com)'. El trigger la lee
   con COALESCE(@app_usuario, 'sistema') al armar la fila de
   auditoría.

   ¿Por qué no basta con db.query('SET @app_usuario=...') seguido de
   db.query('UPDATE ...')? Porque el pool le puede dar a cada
   .query() una conexión DISTINTA de las 10 que tiene reservadas —
   las variables @sesión solo viven dentro de UNA conexión. Por eso
   aquí se pide una conexión fija con getConnection() y TODO pasa
   por ella (el SET y la consulta real), antes de devolverla al pool.

   Uso típico en una ruta:
     await db.conActor(actorLabel(req), async (conn) => {
       await conn.query('UPDATE productos SET ... WHERE id = ?', [id]);
     });
---------------------------------------------------------------- */
async function conActor(actorLabel, fn) {
  const conn = await pool.getConnection();
  try {
    // COALESCE en el trigger ya cubre el caso de que esto no se
    // llame nunca (@app_usuario sería NULL) — aquí solo nos
    // aseguramos de no arrastrar el actor de una petición anterior
    // que reusó esta misma conexión del pool.
    await conn.query('SET @app_usuario = ?', [actorLabel || null]);
    return await fn(conn);
  } finally {
    try { await conn.query('SET @app_usuario = NULL'); } catch (_) { /* no crítico */ }
    conn.release();
  }
}

// Exportamos el pool para que cualquier archivo del backend pueda
// hacer consultas con: const [filas] = await db.query('SELECT ...')
module.exports = pool;
module.exports.conActor = conActor;
