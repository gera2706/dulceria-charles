/* ================================================================
   ARCHIVO: backend/server.js
   PROPÓSITO: Punto de entrada del servidor. Es el primer archivo
   que se ejecuta cuando hacemos "node server.js".

   ¿QUÉ HACE ESTE ARCHIVO?
   1. Carga las librerías necesarias
   2. Configura comportamientos globales (middlewares)
   3. Registra todas las rutas de la API
   4. Sirve los archivos del frontend (HTML, CSS, JS)
   5. Inicia el servidor en el puerto indicado

   ARQUITECTURA GENERAL DEL PROYECTO:
   ┌─────────────────────────────────────────────┐
   │  NAVEGADOR (frontend)                        │
   │  HTML + CSS + JS (carpeta raíz del proyecto) │
   └──────────────┬──────────────────────────────┘
                  │ HTTP (fetch / peticiones)
   ┌──────────────▼──────────────────────────────┐
   │  SERVIDOR (backend) ← este archivo           │
   │  Node.js + Express                           │
   │  Puerto 3000                                 │
   └──────────────┬──────────────────────────────┘
                  │ SQL (consultas)
   ┌──────────────▼──────────────────────────────┐
   │  BASE DE DATOS                               │
   │  MySQL → dulceria_charles                    │
   └─────────────────────────────────────────────┘
================================================================ */

require('dotenv').config();
// Carga las variables del .env (contraseñas, secretos, configuración)
// para que estén disponibles como process.env.VARIABLE
// Si no llamamos esto primero, process.env.JWT_SECRET sería undefined.

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
// Creamos la aplicación Express. Todas las configuraciones se hacen sobre "app".

/* ── MIDDLEWARES GLOBALES ──────────────────────────────────────
   Estos middlewares se ejecutan en TODAS las peticiones que
   lleguen al servidor, antes de que lleguen a su ruta.
   app.use() registra un middleware para todo.
────────────────────────────────────────────────────────────── */

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  methods: ['GET','POST','PUT','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json());

/* ── Rate limiting ──────────────────────────────────────────
   Limita intentos en rutas de autenticación para prevenir
   ataques de fuerza bruta.
────────────────────────────────────────────────────────── */
app.use('/api/auth/login',    rateLimit({ windowMs: 15*60*1000, max: 10,  message: { error: 'Demasiados intentos. Espera 15 minutos.' } }));
app.use('/api/auth/registro', rateLimit({ windowMs: 60*60*1000, max: 5,   message: { error: 'Demasiados registros desde esta IP.' } }));
// Sin esto, req.body sería undefined en las rutas POST/PUT.
// Este middleware lee el cuerpo de la petición y lo parsea de JSON a objeto JS.
// Ejemplo: recibe '{"email":"a@b.com"}' y lo convierte a { email: "a@b.com" }

/* ── ARCHIVOS ESTÁTICOS DEL FRONTEND ──────────────────────────
   Le dice a Express que sirva los archivos del frontend.
   __dirname = carpeta donde está este archivo (backend/)
   '..' = un nivel arriba = carpeta raíz del proyecto
   Esto hace que http://localhost:3000/index.html devuelva index.html,
   http://localhost:3000/css/style.css devuelva el CSS, etc.
   Con esto, UN SOLO servidor sirve tanto el frontend como la API.
────────────────────────────────────────────────────────────── */
app.use(express.static(path.join(__dirname, '..')));

/* ── RUTAS DE LA API ──────────────────────────────────────────
   Cada línea conecta un prefijo de URL con su archivo de rutas.
   Por ejemplo: toda petición que empiece con /api/productos
   se maneja en el archivo routes/productos.js

   El prefijo /api/ nos sirve para distinguir peticiones a la API
   de peticiones a archivos estáticos del frontend.
────────────────────────────────────────────────────────────── */
app.use('/api/auth',       require('./routes/auth'));        // /api/auth/login, /api/auth/registro
app.use('/api/productos',  require('./routes/productos'));   // /api/productos, /api/productos/5
app.use('/api/pedidos',    require('./routes/pedidos'));     // /api/pedidos, /api/pedidos/mios
app.use('/api/favoritos',  require('./routes/favoritos'));   // /api/favoritos
app.use('/api/cupones',    require('./routes/cupones'));     // /api/cupones/validar
app.use('/api/usuarios',   require('./routes/usuarios'));    // /api/usuarios
app.use('/api/config',     require('./routes/config'));      // /api/config/contacto
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/upload',    require('./routes/upload')); // /api/categorias

/* ── MANEJADOR DE RUTAS NO ENCONTRADAS ────────────────────────
   Este middleware se ejecuta cuando ninguna ruta anterior
   coincidió con la petición (se registra al final por eso).

   - Si la URL empieza con /api/ → devuelve error JSON (la ruta
     de API no existe)
   - Para cualquier otra URL → devuelve index.html para que el
     navegador cargue el frontend normalmente
────────────────────────────────────────────────────────────── */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado.' });
  }
  // Para rutas del frontend como /admin.html, /catalogo.html, etc.
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

/* ── INICIAR EL SERVIDOR ──────────────────────────────────────
   app.listen() hace que el servidor empiece a recibir peticiones.
   El callback (función) se ejecuta UNA sola vez cuando ya está listo.
   process.env.PORT permite configurar el puerto desde el .env,
   útil cuando lo subamos a hosting (Namecheap, Render, etc.)
────────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🍬 Dulcería Charles API corriendo en http://localhost:${PORT}`);
  console.log(`   Frontend:  http://localhost:${PORT}`);
  console.log(`   API:       http://localhost:${PORT}/api/productos\n`);
});
