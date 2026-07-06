require('dotenv').config();
const db = require('./db');

async function run() {
  /* 1. Convertir ENUM → VARCHAR para permitir categorías dinámicas */
  await db.query(`
    ALTER TABLE productos
    MODIFY COLUMN categoria VARCHAR(50) NOT NULL
  `);
  console.log('✅ productos.categoria convertida a VARCHAR(50)');

  /* 2. Crear tabla de categorías */
  await db.query(`
    CREATE TABLE IF NOT EXISTS categorias (
      id     INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(50) NOT NULL UNIQUE
    ) ENGINE=InnoDB
  `);
  console.log('✅ Tabla categorias creada');

  /* 3. Poblar con las categorías existentes */
  await db.query(`
    INSERT IGNORE INTO categorias (nombre) VALUES
    ('bombones'),('botanas'),('chocolates'),
    ('enchilados'),('gomitas'),('mazapanes'),('paletas')
  `);
  console.log('✅ Categorías iniciales insertadas');

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
