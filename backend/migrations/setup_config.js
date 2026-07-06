require('dotenv').config();
const db = require('./db');

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave VARCHAR(100) PRIMARY KEY,
      valor TEXT
    ) ENGINE=InnoDB
  `);

  await db.query(`
    INSERT IGNORE INTO configuracion (clave, valor) VALUES
    ('contacto_direccion', 'Av. Dulce 123, Col. Centro'),
    ('contacto_ciudad',    'Ciudad de México, CDMX'),
    ('contacto_horario',   'Lunes a Viernes: 9:00 – 20:00|Sábados: 10:00 – 18:00|Domingos: 11:00 – 15:00'),
    ('contacto_telefono',  '+52 55 1234 5678'),
    ('contacto_email',     'hola@dulceriacharles.com'),
    ('contacto_instagram', '#'),
    ('contacto_facebook',  '#'),
    ('contacto_whatsapp',  '#'),
    ('contacto_twitter',   '#')
  `);

  console.log('✅ Tabla configuracion creada con datos iniciales');
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
