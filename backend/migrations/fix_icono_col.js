require('dotenv').config();
const db = require('./db');
async function run() {
  await db.query("ALTER TABLE categorias MODIFY COLUMN icono VARCHAR(500) DEFAULT '🍬'");
  console.log('✅ Columna icono ampliada a VARCHAR(500)');
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
