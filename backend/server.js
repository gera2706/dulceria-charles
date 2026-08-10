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
const helmet    = require('helmet');

const app = express();
// Creamos la aplicación Express. Todas las configuraciones se hacen sobre "app".

/* ── Cabeceras de seguridad (helmet) ───────────────────────────
   Se agregó tras un escaneo de seguridad (OWASP ZAP, agosto/2026)
   que encontró 3 huecos reales en las cabeceras de respuesta:
     1. Sin Content-Security-Policy → un XSS que lograra inyectar
        HTML podría cargar script/estilos de cualquier origen.
     2. Sin protección anti-clickjacking (X-Frame-Options) → el
        sitio se podía embeber en un <iframe> ajeno para trucos de
        "clickjacking" (superponer botones invisibles encima).
     3. Recursos de Google Fonts sin atributo de integridad (SRI) →
        se resolvió aparte, auto-hospedando las fuentes (ver
        public/css/style.css y public/fonts/), así que aquí ya no
        hace falta abrirle un hueco a fonts.googleapis.com/gstatic.com.
   helmet() solo, sin configurar nada, YA trae por defecto varias
   cosas más que también salieron en el escaneo (todas de riesgo
   bajo): Strict-Transport-Security (HSTS), X-Content-Type-Options,
   y ocultar el header "X-Powered-By: Express" que delataba la
   tecnología del backend.

   La política de abajo es la mínima necesaria para que el sitio siga
   funcionando igual — se armó revisando TODO public/ (cada <script>,
   cada <link>, cada <iframe>) antes de escribirla, no es una plantilla
   genérica. Los únicos orígenes externos que el sitio realmente usa:
     - www.google.com → el iframe de Google Maps en contacto.html
   Todo lo demás (scripts, imágenes, estilos, llamadas a la API) es
   del propio dominio. */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"], // todos los <script> del sitio son propios (js/*.js) — ver commit que sacó los últimos inline a archivos aparte
      styleSrc:   ["'self'", "'unsafe-inline'"], // el sitio usa bastantes style="" inline (toggles de mostrar/ocultar); migrarlos todos a clases CSS es un cambio grande aparte, no parte de este arreglo
      imgSrc:     ["'self'", 'data:'], // 'data:' por el favicon (emoji en SVG inline)
      fontSrc:    ["'self'"], // fuentes auto-hospedadas en public/fonts/, ya no dependen de Google
      connectSrc: ["'self'"], // fetch()/XHR del frontend solo hablan con esta misma API
      frameSrc:   ['https://www.google.com'], // el <iframe> de Google Maps en contacto.html
      objectSrc:  ["'none'"],
      baseUri:    ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"], // refuerzo moderno del anti-clickjacking, además del header X-Frame-Options de abajo
    },
  },
  // Refuerzo clásico del anti-clickjacking (frameAncestors de arriba es
  // el equivalente moderno, pero X-Frame-Options lo respetan también
  // navegadores más viejos que no leen frame-ancestors).
  frameguard: { action: 'deny' },
}));

/* ── Confiar en el proxy del hosting ───────────────────────────
   En producción, el sitio no recibe las peticiones directamente:
   pasan primero por el servidor web del hosting (LiteSpeed), que
   las reenvía a este proceso de Node y le agrega un encabezado
   X-Forwarded-For con la IP real de quien visita el sitio.

   Sin esta línea, Express IGNORA ese encabezado por seguridad
   (para que nadie lo falsifique) y usa la IP de la conexión que
   sí ve directamente — que siempre es la del propio proxy, la
   MISMA para todos los visitantes. Eso hacía que express-rate-limit
   (más abajo) contara a todos los clientes como si fueran uno solo:
   bastaba con que varias personas usaran el sitio a la vez para que
   se agotara el límite de "10 intentos de login" o el de "300
   peticiones" entre TODOS, y el siguiente visitante recibiera
   "Demasiados intentos" sin haber hecho nada.

   El "1" significa "confía en un solo salto de proxy delante de
   mí" (el de LiteSpeed) — así Express sí usa la IP real de cada
   visitante para separar sus contadores. */
app.set('trust proxy', 1);

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

// Límite general y generoso sobre toda la API, además de los límites
// específicos de arriba — cubre endpoints públicos de solo lectura
// (ej: /api/productos) que antes no tenían ningún límite, contra
// scraping agresivo o un mini-DoS de aplicación.
app.use('/api', rateLimit({ windowMs: 15*60*1000, max: 300, message: { error: 'Demasiadas peticiones. Intenta de nuevo en unos minutos.' } }));
// Sin esto, req.body sería undefined en las rutas POST/PUT.
// Este middleware lee el cuerpo de la petición y lo parsea de JSON a objeto JS.
// Ejemplo: recibe '{"email":"a@b.com"}' y lo convierte a { email: "a@b.com" }

/* ── ARCHIVOS ESTÁTICOS DEL FRONTEND ──────────────────────────
   Le dice a Express que sirva los archivos del frontend.
   __dirname = carpeta donde está este archivo (backend/)
   '..', 'public' = un nivel arriba, carpeta public/ del proyecto
   Esto hace que http://localhost:3000/index.html devuelva index.html,
   http://localhost:3000/css/style.css devuelva el CSS, etc.
   Con esto, UN SOLO servidor sirve tanto el frontend como la API.

   IMPORTANTE (fix de seguridad): antes esto apuntaba a la raíz del
   proyecto (path.join(__dirname, '..')), lo que exponía backend/
   completo (db.js, server.js, .env.example) y dulceria_charles.sql
   (con el hash del admin) como archivos estáticos descargables sin
   autenticarse. El frontend se movió a public/ y ahora SOLO esa
   carpeta se sirve como estático.
────────────────────────────────────────────────────────────── */
app.use(express.static(path.join(__dirname, '..', 'public')));

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
// Nota: el proyecto no maneja cupones de descuento — la ruta /api/cupones
// (y su tabla en la BD) se eliminaron a propósito, no falta agregarla.
app.use('/api/usuarios',   require('./routes/usuarios'));    // /api/usuarios
app.use('/api/config',     require('./routes/config'));      // /api/config/contacto
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/chatbot-faq', require('./routes/chatbot_faq')); // preguntas frecuentes del chatbot del sitio
app.use('/api/upload',    require('./routes/upload')); // /api/categorias
app.use('/api/avisos-stock', require('./routes/avisos'));    // panel admin: avisos de stock bajo/agotado
app.use('/api/auditorias',   require('./routes/auditorias')); // panel admin: HTML de auditorías (solo admin)
app.use('/api/respaldos',    require('./routes/respaldos'));  // panel admin: botón "Generar respaldo ahora"

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
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

/* ── RED DE SEGURIDAD: promesas rechazadas sin manejar ────────
   Express 4 no captura errores async lanzados fuera de un try/catch
   dentro de un handler (ej: si db.getConnection() falla). Sin este
   handler, ese rechazo se propaga como una excepción no manejada
   del proceso de Node y puede tumbar el servidor completo para
   TODOS los usuarios. Ya se revisaron y protegieron con try/catch
   las rutas transaccionales de pedidos.js, pero este handler queda
   como red de seguridad ante cualquier caso que se nos escape.
────────────────────────────────────────────────────────────── */
process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada sin manejar:', reason);
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
