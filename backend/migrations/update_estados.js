require('dotenv').config();
const db = require('./db');

async function run() {
  // PASO 1: Ampliar el ENUM para que acepte los valores nuevos junto con los viejos
  await db.query(`
    ALTER TABLE pedidos MODIFY COLUMN estado
    ENUM('inconcluso','pendiente','confirmado','enviado','entregado','cancelado','pendiente_finalizar','pendiente_entregar')
    DEFAULT 'pendiente_entregar'
  `);
  console.log('✅ ENUM ampliado');

  // PASO 2: Migrar los datos al nuevo esquema de nombres
  await db.query("UPDATE pedidos SET estado='pendiente_finalizar' WHERE estado='inconcluso'");
  await db.query("UPDATE pedidos SET estado='pendiente_entregar'  WHERE estado IN ('pendiente','confirmado','enviado')");
  console.log('✅ Datos migrados');

  // PASO 3: Ahora que no hay datos con valores viejos, dejamos solo los nuevos
  await db.query(`
    ALTER TABLE pedidos MODIFY COLUMN estado
    ENUM('pendiente_finalizar','pendiente_entregar','entregado','cancelado')
    DEFAULT 'pendiente_entregar'
  `);
  console.log('✅ ENUM reducido a nuevos valores');
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
