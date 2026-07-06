require('dotenv').config();
const db = require('./db');

async function run() {
  await db.query("ALTER TABLE categorias ADD COLUMN IF NOT EXISTS icono VARCHAR(10) DEFAULT '🍬'").catch(() =>
    db.query("ALTER TABLE categorias ADD COLUMN icono VARCHAR(10) DEFAULT '🍬'").catch(() => {})
  );
  const iconos = [
    ['bombones','🍡'],['botanas','🍿'],['chocolates','🍫'],
    ['enchilados','🌶️'],['gomitas','🐻'],['mazapanes','🥜'],['paletas','🍭'],
    ['refrescos','🥤']
  ];
  for (const [nombre, icono] of iconos) {
    await db.query('UPDATE categorias SET icono=? WHERE nombre=?', [icono, nombre]);
  }
  console.log('✅ Columna icono agregada y categorías actualizadas');
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
