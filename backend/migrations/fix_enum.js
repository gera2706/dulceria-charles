require('dotenv').config();
const db = require('./db');

db.query(
  "ALTER TABLE pedidos MODIFY estado ENUM('inconcluso','pendiente','confirmado','enviado','entregado','cancelado') DEFAULT 'pendiente'"
).then(() => {
  console.log('✅ ENUM de pedidos actualizado correctamente');
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
