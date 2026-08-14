-- ============================================================
--  DULCERÍA CHARLES — Esquema para HOSTING COMPARTIDO (cPanel)
--
--  Versión especial de dulceria_charles.sql para usarse en un
--  hosting compartido: NO incluye DROP DATABASE / CREATE DATABASE
--  / USE, porque el usuario de la base de datos del hosting no
--  tiene permiso para crear o borrar bases completas (eso ya lo
--  hace el "MySQL Database Wizard" de cPanel por ti).
--
--  Regenerado el 2026-08-07 a partir de dulceria_charles.sql para
--  que coincida exactamente con el esquema real: incluye las
--  columnas reset_token/reset_token_expira (recuperación de
--  contraseña), los 8 triggers de auditoría, los 3 procedimientos
--  almacenados y las 3 vistas — la versión anterior de este
--  archivo era de antes de esas features y le faltaban.
--
--  CÓMO USARLO:
--  1. En cPanel, entra a phpMyAdmin.
--  2. En la columna izquierda, haz clic en tu base de datos
--     (algo como "usuario_dulceria_charles").
--  3. Ve a la pestaña "Import" / "Importar" (arriba).
--  4. Elige este archivo y dale a "Go" / "Importar".
-- ============================================================

-- ── USUARIOS ──────────────────────────────────────────────
-- reset_token / reset_token_expira: recuperación de contraseña por
-- correo. Guardamos un HASH del token (sha256), nunca el token en
-- texto plano — igual que con las contraseñas, así si alguien lee
-- la base de datos no puede fabricar un link de reseteo válido.
CREATE TABLE IF NOT EXISTS usuarios (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  nombre              VARCHAR(100)  NOT NULL,
  apellido            VARCHAR(100)  DEFAULT NULL,
  email               VARCHAR(150)  NOT NULL UNIQUE,
  telefono            VARCHAR(20)   DEFAULT NULL,
  password            VARCHAR(255)  NOT NULL,
  rol                 ENUM('cliente','admin') DEFAULT 'cliente',
  fecha_registro      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  reset_token         VARCHAR(64)   DEFAULT NULL,
  reset_token_expira  DATETIME      DEFAULT NULL
) ENGINE=InnoDB;

-- ── CATEGORÍAS ────────────────────────────────────────────
-- icono acepta un emoji ("🍬") o una ruta/URL de imagen
-- (ej: "img/categorias/refrescos.jpg"), ver js/cat-icon.js.
CREATE TABLE IF NOT EXISTS categorias (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50)  NOT NULL UNIQUE,
  icono  VARCHAR(500) DEFAULT '🍬'
) ENGINE=InnoDB;

-- ── CHATBOT: PREGUNTAS FRECUENTES ────────────────────────
-- Preguntas rápidas / palabras clave del chatbot del sitio (ver
-- cart.js, sección CHATBOT DEL SITIO). El admin las administra desde
-- el panel (sec-chatbot) sin tocar código.
-- respuesta admite los placeholders {direccion} {horario} {telefono}
-- {email}, que se rellenan con los datos reales de Configuración >
-- Contacto al mostrarse (ver chatFillPlaceholders() en cart.js).
-- accion_tipo: ninguna | link | whatsapp | catalogo | pedidos
--   - link:     accion_valor = URL, accion_texto = texto del botón
--   - catalogo: accion_valor = categoría opcional (vacío = catálogo completo)
--   - pedidos:  lleva a pedidos.html si hay sesión, si no a login.html
--   - whatsapp: no agrega botón propio, solo apunta al CTA de WhatsApp ya visible
CREATE TABLE IF NOT EXISTS chatbot_faq (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  pregunta       VARCHAR(150)  NOT NULL,
  palabras_clave VARCHAR(500)  DEFAULT '',
  respuesta      TEXT          NOT NULL,
  accion_tipo    VARCHAR(20)   NOT NULL DEFAULT 'ninguna',
  accion_valor   VARCHAR(300)  DEFAULT '',
  accion_texto   VARCHAR(100)  DEFAULT '',
  orden          INT           NOT NULL DEFAULT 0,
  activo         TINYINT(1)    DEFAULT 1,
  INDEX idx_activo_orden (activo, orden)
) ENGINE=InnoDB;

-- ── PRODUCTOS ─────────────────────────────────────────────
-- categoria es VARCHAR para que las categorías dinámicas del admin funcionen.
-- No usar ENUM aquí porque rompe al crear categorías nuevas desde el panel.
-- fk_productos_categoria (con ON UPDATE CASCADE) refuerza a nivel de BD lo
-- que antes solo garantizaba el código de la app: si algún día categorias.js
-- deja de hacer su UPDATE manual al renombrar una categoría, MySQL lo hace
-- de todos modos (auditoría de modelado 2026-07-30, hallazgo alto).
CREATE TABLE IF NOT EXISTS productos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(200)  NOT NULL,
  categoria       VARCHAR(100)  NOT NULL,
  precio          DECIMAL(10,2) NOT NULL,
  imagen          VARCHAR(600),
  destacado       TINYINT(1)    DEFAULT 0,
  activo          TINYINT(1)    DEFAULT 1,
  proveedor       VARCHAR(150),
  stock           INT           NOT NULL DEFAULT 20,
  stock_minimo    INT           NOT NULL DEFAULT 5,
  -- Último nivel de alerta de stock que ya se le avisó al dueño por
  -- correo (ver backend/utils/stockAlertas.js). Evita mandar un correo
  -- por cada unidad que se vende mientras el producto sigue "bajo":
  -- solo se manda uno nuevo cuando el nivel EMPEORA (ninguna→bajo,
  -- bajo→agotado). Vuelve a 'ninguna' solo cuando se repone stock.
  alerta_stock_enviada ENUM('ninguna','bajo','agotado') NOT NULL DEFAULT 'ninguna',
  fecha_creacion  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria) REFERENCES categorias(nombre)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_productos_precio CHECK (precio > 0),
  CONSTRAINT chk_productos_stock  CHECK (stock >= 0),
  INDEX idx_activo_cat (activo, categoria),
  INDEX idx_destacado  (destacado),
  FULLTEXT INDEX ft_productos_nombre (nombre)
) ENGINE=InnoDB;

-- ── CONFIGURACIÓN ─────────────────────────────────────────
-- Diccionario clave → valor para los datos de contacto/pickup del
-- sitio (backend/routes/config.js). Antes solo existía en el script
-- suelto backend/migrations/setup_config.js y nunca se integró aquí,
-- lo que rompía contacto.html, el panel admin y el pickup en pago.js
-- en cualquier instalación nueva de la BD (mismo tipo de bug que ya
-- había pasado con la tabla categorias).
CREATE TABLE IF NOT EXISTS configuracion (
  clave VARCHAR(100) PRIMARY KEY,
  valor TEXT
) ENGINE=InnoDB;

-- ── PEDIDOS ───────────────────────────────────────────────
-- Modelo pickup: el cliente recoge en tienda, no hay dirección de envío.
-- Estados alineados con el backend (routes/pedidos.js).
-- No tiene columnas de cupón/descuento: el proyecto no maneja cupones.
CREATE TABLE IF NOT EXISTS pedidos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id    INT           NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL,
  total         DECIMAL(10,2) NOT NULL,
  estado        ENUM('pendiente_finalizar','pendiente_entregar','entregado','cancelado')
                NOT NULL DEFAULT 'pendiente_finalizar',
  metodo_pago   VARCHAR(50),
  nombre_envio  VARCHAR(150),
  telefono      VARCHAR(20),
  fecha         DATETIME      DEFAULT CURRENT_TIMESTAMP,
  -- Cancelaciones: quién canceló y por qué. NULL mientras el pedido no
  -- esté cancelado. cancelado_por distingue si fue el propio cliente
  -- (POST /api/pedidos/:id/cancelar) o el admin (PATCH /:id/estado)
  -- para poder avisarle a la otra parte (ver backend/mailer.js →
  -- enviarAvisoCancelacion).
  motivo_cancelacion VARCHAR(255),
  cancelado_por      ENUM('cliente','admin'),
  CONSTRAINT fk_pedidos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  INDEX idx_usuario_id (usuario_id),
  INDEX idx_estado     (estado)
) ENGINE=InnoDB;

-- ── ITEMS DE PEDIDO ───────────────────────────────────────
-- producto_id puede ser NULL si el producto fue eliminado (soft-delete).
-- nombre y precio se copian al momento del pedido para preservar el historial.
CREATE TABLE IF NOT EXISTS pedido_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id    INT           NOT NULL,
  producto_id  INT,
  nombre       VARCHAR(200)  NOT NULL,
  precio       DECIMAL(10,2) NOT NULL,
  cantidad     INT           NOT NULL,
  CONSTRAINT fk_pedido_items_pedido   FOREIGN KEY (pedido_id)   REFERENCES pedidos(id)   ON DELETE CASCADE,
  CONSTRAINT fk_pedido_items_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL,
  CONSTRAINT chk_pedido_items_cantidad CHECK (cantidad > 0),
  INDEX idx_pedido_id (pedido_id)
) ENGINE=InnoDB;

-- ── FAVORITOS ─────────────────────────────────────────────
-- ── AVISOS DE STOCK ───────────────────────────────────────
-- Bitácora de avisos de stock bajo/agotado mandados al dueño (por
-- correo, ver backend/mailer.js → enviarAlertaStock). Dos orígenes:
--   'sistema' → el backend detectó que un producto cruzó el umbral
--               de stock bajo o se agotó (ver backend/utils/stockAlertas.js)
--   'cliente' → un cliente con un pedido incompleto tocó "Avisar al
--               dueño" porque el producto que quería ya se agotó
--               (ver POST /api/pedidos/:id/avisar-agotado)
-- Se usa para la sección "🔔 Avisos" del panel admin (punto 3 y 6
-- del pedido de features de agosto/2026).
CREATE TABLE IF NOT EXISTS avisos_stock (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  producto_id   INT NOT NULL,
  tipo          ENUM('bajo','agotado') NOT NULL,
  origen        ENUM('sistema','cliente') NOT NULL,
  usuario_id    INT,
  pedido_id     INT,
  fecha         DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_avisos_stock_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  CONSTRAINT fk_avisos_stock_usuario  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)  ON DELETE SET NULL,
  CONSTRAINT fk_avisos_stock_pedido   FOREIGN KEY (pedido_id)   REFERENCES pedidos(id)   ON DELETE SET NULL,
  INDEX idx_avisos_stock_fecha (fecha)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS favoritos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT  NOT NULL,
  producto_id  INT  NOT NULL,
  fecha        DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_fav (usuario_id, producto_id),
  CONSTRAINT fk_favoritos_usuario  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)  ON DELETE CASCADE,
  CONSTRAINT fk_favoritos_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  INDEX idx_usuario_id (usuario_id)
) ENGINE=InnoDB;

-- ── AUDITORÍA ─────────────────────────────────────────────
-- Bitácora automática de cambios (aportada por Eduardo, integrada aquí
-- el 31-jul-2026). Los triggers de más abajo escriben aquí solos, sin
-- que el backend Node tenga que hacer nada extra.
CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria      INT AUTO_INCREMENT PRIMARY KEY,
  tabla_afectada    VARCHAR(50) NOT NULL,
  accion            ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  id_registro       INT NOT NULL,
  usuario           VARCHAR(100),
  descripcion       VARCHAR(255),
  datos_anteriores  JSON,
  datos_nuevos      JSON,
  fecha             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
--  DATOS INICIALES
-- ============================================================

-- Admin  (password: admin123)
-- IMPORTANTE: Cambiar la contraseña antes de producción real.
-- Correo real del dueño (charlesdulceria@gmail.com): así la recuperación
-- de contraseña de esta cuenta funciona desde una instalación nueva,
-- sin tener que acordarse de cambiarlo a mano después.
INSERT INTO usuarios (nombre, email, password, rol) VALUES
('Administrador', 'charlesdulceria@gmail.com',
 '$2a$10$.lVaHAere803JSviyRCNneVSVnEKnyPCzt2sDr7pqVoy50//wVS2i', 'admin');

-- Categorías
INSERT INTO categorias (nombre, icono) VALUES
('bombones',   '🍡'),
('botanas',    '🍿'),
('chocolates', '🍫'),
('enchilados', '🌶️'),
('gomitas',    '🐻'),
('mazapanes',  '🥜'),
('paletas',    '🍭'),
('refrescos',  '🥤');

-- Chatbot: preguntas frecuentes por defecto (mismas que traía el chatbot
-- antes de ser configurable, para no perder el comportamiento actual)
INSERT INTO chatbot_faq (pregunta, palabras_clave, respuesta, accion_tipo, accion_valor, accion_texto, orden) VALUES
('📍 Ubicación y horario',
 'horario,hora,abren,cierran,direccion,ubicacion,domicilio,donde estan,donde queda',
 '📍 {direccion}\n🕒 {horario}', 'ninguna', '', '', 1),
('🛍️ ¿Cómo hago un pedido?',
 'como pido,como compro,hacer un pedido,como funciona,proceso de compra',
 'Es bien fácil: 1️⃣ elige tus productos y agrégalos al carrito 🛒, 2️⃣ ve a pagar y confirma tus datos, 3️⃣ pasas a recoger tu pedido a la tienda y pagas en efectivo al recogerlo 💵.',
 'ninguna', '', '', 2),
('🍬 Ver catálogo',
 'catalogo,productos,que venden,bombones,chocolates,gomitas,mazapanes,botanas,enchilados,paletas,refrescos,dulces',
 'Tenemos bombones, botanas, chocolates, enchilados, gomitas, mazapanes, paletas y refrescos 🍬.',
 'catalogo', '', '🍬 Ir al catálogo →', 3),
('💳 Métodos de pago',
 'pago,pagar,efectivo,tarjeta,transferencia,metodo de pago',
 'Por ahora solo manejamos pago en efectivo, directo al recoger tu pedido en tienda 💵.',
 'ninguna', '', '', 4),
('📦 Estado de mi pedido',
 'mi pedido,estado de mi pedido,donde va mi pedido,rastrear,numero de pedido',
 'Puedes ver el estado de todos tus pedidos desde tu cuenta.',
 'pedidos', '', '📦 Ver mis pedidos →', 5),
('💬 Hablar con una persona',
 'whatsapp,humano,persona,asesor,hablar con alguien,atencion',
 'Claro, te comunico con nosotros 👇 toca el botón verde de abajo para seguir por WhatsApp.',
 'whatsapp', '', '', 6);

-- Configuración (datos de contacto/pickup, ver backend/routes/config.js)
INSERT INTO configuracion (clave, valor) VALUES
('contacto_direccion', 'C. Niños Héroes 304'),
('contacto_ciudad',    'Durango, Dgo.'),
('contacto_horario',   'Lunes a Viernes: 9:00 – 20:00|Sábados: 10:00 – 18:00|Domingos: 11:00 – 15:00'),
('contacto_telefono',  '+52 55 1234 5678'),
('contacto_email',     'charlesdulceria@gmail.com'),
('contacto_whatsapp',  '#');

-- Productos
INSERT INTO productos (id, nombre, categoria, precio, imagen, destacado) VALUES
(1,  'Bianchi Corazón 400gr',          'bombones',   53,  'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR BIANCHI CORAZON 400gr $53.webp', 0),
(2,  'Bombon Mediano Colores 400gr',    'bombones',   43,  'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR BOMBOM MEDIANO COLORES 400gr $43.webp', 0),
(3,  'Bombon Mini Blanco 400gr',        'bombones',   48,  'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR BOMBOM MINI BLANCO 400gr $48.webp', 0),
(4,  'Bombón de Chocolate 50pz',        'bombones',  120,  'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR BOMBON DE CHOCOLATE 50pz $120.webp', 1),
(5,  'Malv Corazón Choc 50pz',          'bombones',  120,  'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR MALV CORAZON CHOC 50pz $120.webp', 0),
(6,  'Malvavisco Malvabón 12pz',        'bombones',   75,  'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR MALVAVISCO MALVABON 12pz $75.webp', 0),
(7,  'Ositos Conejos Pollitos 400gr',   'bombones',   43,  'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR OSITOS CONEJOS POLLITOS 400gr $43.webp', 1),
(8,  'Paleta Malvabony 40pz',           'bombones',   85,  'img/productos/Bombones-20260528T212319Z-3-001/Bombones/DLR PAL MALVABONY 40pz $85.webp', 0),
(9,  'Paleta Payaso Ricolino 10pz',     'bombones',  120,  'img/productos/Bombones-20260528T212319Z-3-001/Bombones/Paleta Payaso de Ricolino  Caja 10 pzas $120.webp', 1),
(10, 'Barcel Combotanas 25pz',          'botanas',   270,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/BARCEL COMBOTANAS 25pz $270.webp', 1),
(11, 'Chechitos Donitas Chile 25pz',    'botanas',    43,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Donitas Chile Intenso Bolsa Chica 25 pzas 150 g $43.webp', 0),
(12, 'Chechitos Kikys Ahumados 24pz',   'botanas',    65,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Kikys Ahumados  Bolsa Mega 24 pzas 480 g $65.webp', 0),
(13, 'Kikys Chile Intenso Chica 25pz',  'botanas',    43,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Kikys Chile Intenso  Bolsa Chica 25 pzas 275 g $43.webp', 0),
(14, 'Kikys Chile Intenso Mega 24pz',   'botanas',    65,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Kikys Chile Intenso  Bolsa Mega 24 pzas 480 g $65.webp', 0),
(15, 'Kikys Queso y Chile 25pz',        'botanas',    43,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Kikys Queso y Chile  Bolsa Chica 25 pzas 275 g $43.webp', 0),
(16, 'Kikys Queso y Jalapeño 25pz',     'botanas',    43,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Chechitos Kikys Queso y Jalapeño  Bolsa Chica 25 pzas 275 g $43.webp', 0),
(17, 'Frituras Chile y Limón 5pz',      'botanas',    75,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Frituras sabor Chile y Limón - Chidas Bolsa 5 pzas $75.webp', 0),
(18, 'Papas Chidas con Sal 5pz',        'botanas',    95,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Papas Chidas con Sal  Paquete 5 bolsas $95.webp', 1),
(19, 'Papas Chidas Limón 5pz',          'botanas',    75,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Papas Chidas Limón  Paquete 5 bolsas $75.webp', 0),
(20, 'Papas Chidas Salsa Negra 5pz',    'botanas',   100,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Papas Chidas Salsa Negra  Paquete 5 bolsas $100.webp', 0),
(21, 'Re-Mix Explosión Frituras 10pz',  'botanas',    70,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Re-Mix Explosion de Frituras - Queso, cebolla y Chile  Bolsa 10 pzas $70.webp', 0),
(22, 'Sabritas Fritos Sal 10pz',        'botanas',    75,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SABRITAS FRITOS SAL TPACK 10pz $75.webp', 0),
(23, 'Sabritas Fritura Minis 50pz',     'botanas',   320,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SABRITAS FRITURA MINIS 963gr 50pz $320.webp', 1),
(24, 'Sabritas Rancheritos 10pz',       'botanas',    75,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SABRITAS RANCHERITOS TPACK 10pz $75.webp', 0),
(25, 'Cacahuate Crujiente 700g',        'botanas',    75,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SOL CACAHUATE CRUJIENTE 700grs $75.webp', 0),
(26, 'Cacahuate Enchilado 1kg',         'botanas',   100,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SOL CACAHUATE ENCHILADO 1K $100.webp', 0),
(27, 'Cacahuate Japonés 1kg',           'botanas',    90,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SOL CACAHUATE JAPONES 1K $90.webp', 0),
(28, 'Cacahuate Salado 1kg',            'botanas',    75,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/SOL CACAHUATE SALADO 1K $75.webp', 0),
(29, 'Totopos Salsa Negra 10pz',        'botanas',    55,  'img/productos/Botanas-20260528T212322Z-3-001/Botanas/Totopos sabor Salsa Negra Bolsa 10 pzas $55.webp', 0),
(30, 'Bremen Flops 500gr',              'chocolates', 100, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/BREMEN FLOPS CHICO 500gr $100.webp', 0),
(31, 'Bremen Galleta Fass 500gr',       'chocolates', 150, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/BREMEN GALLETA FASS 500gr $150.webp', 0),
(32, 'Kinder Delice 10pz',              'chocolates', 135, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/Chocolate Kinder Delice 10 pz $135.webp', 1),
(33, 'Winky Nougat De La Rosa 10pz',    'chocolates', 120, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/Chocolates Winky Nougat De La Rosa  Caja 10 pzas 560 g $120.webp', 0),
(34, 'Chocoretas Clásicas 500g',        'chocolates', 130, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/Chocoretas Clásicas de Ricolino  Bolsa 500 g $130.webp', 0),
(35, 'Choco Nugs Recreo 10pz',          'chocolates', 120, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/DLR CHOCO NUGS RECREO 10pz $120.webp', 0),
(36, 'Chocolate Coconugs 12pz',         'chocolates',  75, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/DLR CHOCOLATE COCONUGS 12pz $75.webp', 0),
(37, 'Chocolate Suizo 16pz',            'chocolates', 135, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/DLR CHOCOLATE SUIZO 16pz $135.webp', 1),
(38, 'Mazapán Chocolate 16pz',          'chocolates',  45, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/DLR MAZAPAN CCHOCOLATE 16pz $45.webp', 0),
(39, 'Milky Way Six Pack 6pz',          'chocolates', 120, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/EFFEM MILKY WAY SIX PACK 6pzs $120.webp', 0),
(40, 'Snickers Almendra 6pz',           'chocolates', 120, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/EFFEM SNIKERS ALMENDRA 43.4GRS 6pzs $120.webp', 0),
(41, 'Snickers Six Pack 6pz',           'chocolates', 120, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/EFFEM SNIKERS SIX PACK 6pzs $120.webp', 1),
(42, 'Ferrero Raffaello 8pz',           'chocolates',  90, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/FERRERO RAFAELLO BL T8 8pz $90.webp', 0),
(43, 'Ferrero Rocher 24pz',             'chocolates', 280, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/FERRERO ROCHER T24 24pz $280.webp', 1),
(44, 'Ferrero Rocher 8pz',              'chocolates',  95, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/FERRERO ROCHER T8 8pz $95.webp', 0),
(45, 'Hersheys Kisses 1kg',             'chocolates', 280, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/HSY KISSES BULK 1K $280.webp', 0),
(46, 'Duvalin Trisabor 18pz',           'chocolates',  50, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/JOYCO DUVALIN TRISABOR 18pz $50.webp', 0),
(47, 'La Corona Huevito 1kg',           'chocolates', 140, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/LA CORONA HUEVITO 1K $140.webp', 0),
(48, 'Nestle Carlos V Suizo 16pz',      'chocolates', 140, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/NESTLE CARLOS V SUIZO 16pz $140.webp', 0),
(49, 'Nestle KitKat 9pz',              'chocolates', 180, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/NESTLE KITKAT 41.5gr 9pz $180.webp', 0),
(50, 'Cremino Bicolor 24pz',            'chocolates',  80, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/NUTRESA CREMINO BICOLOR 24pz $80.webp', 0),
(51, 'Ricolino Bubulubu 12pz',          'chocolates', 140, 'img/productos/Chocolates-20260528T212323Z-3-001/Chocolates/RICOLINO BUBULUBU 12pz $140.webp', 0),
(52, 'Pelón Pelórico 12pz',             'enchilados',  90, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/HSY PELON PELORICO 12pz $90.webp', 1),
(53, 'Peloneta Chamoy 10pz',            'enchilados',  55, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/HSY PELONETA PUESTO CHAMOY 10pz $55.webp', 0),
(54, 'Pelonetes 6pz',                   'enchilados',  55, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/HSY PELONETES 6pz $55.webp', 0),
(55, 'Lucas Gusano Chamoy 10pz',        'enchilados',  90, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/LUCAS GUSANO DE CHAMOY 10pzs $90.webp', 0),
(56, 'Lucas Muecas Chamoy 10pz',        'enchilados',  95, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/LUCAS MUECAS CHAMOY 10pzs $95.webp', 1),
(57, 'Lucas Muecas Pepino 10pz',        'enchilados',  95, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/LUCAS MUECAS PEPINO 10pzs $95.webp', 0),
(58, 'Lucas Panzón Sandcham 10pz',      'enchilados', 100, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/LUCAS PANZON SANDCHAM 10pzs $100.webp', 0),
(59, 'Lucas Salsaghetti 12pz',          'enchilados', 110, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/LUCAS SALSAGHETTI SANTAM 12pzs $110.webp', 1),
(60, 'Pulparindo Gigante 16pz',         'enchilados', 100, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/Pulparindo Gigante Extra Picante  De La Rosa  Caja 16 pzas 448 g $100.webp', 0),
(61, 'Pulparindots 20pz',               'enchilados', 115, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/Pulparindots De La Rosa  Caja 20 pzas 600 g $115.webp', 0),
(62, 'Vero Picagoma Fresa 100pz',       'enchilados',  84, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/VERO PICAGOMA FRESA 100pzs $84.webp', 0),
(63, 'Vero Picagoma Fresa Grande 60pz', 'enchilados', 105, 'img/productos/Enchilados-20260528T212324Z-3-001/Enchilados/VERO PICAGOMA FRESA GNTE 60pzs $105.webp', 0),
(64, 'Gomilocas Pingüinos 1kg',         'gomitas',    145, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomilocas Pingüinos 1 kg $ 145 .webp', 1),
(65, 'Aros de Durazno 1kg',             'gomitas',    100, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Aros de Durazno - Lucky Gummy  Bolsa 1 kg $100.webp', 0),
(66, 'Aros de Manzana 1kg',             'gomitas',    105, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Aros de Manzana - Lucky Gummy  Bolsa 1 kg $105.webp', 0),
(67, 'Ositos Icee Canels 454g',         'gomitas',     65, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Canel_s Ositos Icee  Bolsa 454 g $65.webp', 0),
(68, 'Gomitas Corazones 1kg',           'gomitas',    100, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Corazones - Lucky Gummy  Bolsa 1 kg $100.webp', 0),
(69, 'Mangusanos Enchilados 1kg',       'gomitas',     95, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Enchiladas Mangusanos - Lucky Gummy  Bolsa 1 kg $ 95.webp', 0),
(70, 'Frutas del Bosque 500g',          'gomitas',     79, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Frutas del Bosque  De La Rosa  Bolsa 500 g $78.77.webp', 0),
(71, 'Frutas Surtidas 1kg',             'gomitas',    125, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Frutas Sabores Surtidos 1 kg $125.webp', 1),
(72, 'Gotitas Lucky Gummy 1kg',         'gomitas',    105, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Gotitas - Lucky Gummy  Bolsa 1 kg $105.webp', 0),
(73, 'Lombrices Lucky Gummy 1kg',       'gomitas',    105, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Lombrices - Lucky Gummy  Bolsa 1 kg $105.webp', 0),
(74, 'Lombriz Neón 1kg',                'gomitas',    105, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Lombriz Neón - Lucky Gummy  Bolsa 1 kg $105.webp', 0),
(75, 'Orugas Lucky Gummy 1kg',          'gomitas',    105, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Orugas - Lucky Gummy  Bolsa 1 kg $ 105.webp', 0),
(76, 'Ositos Clásicos 1kg',             'gomitas',    105, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Ositos clásicos - Lucky Gummy  Bolsa 1 kg $105.webp', 0),
(77, 'Panditas Clásicos Ricolino 1kg',  'gomitas',    145, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Panditas Clásicos Ricolino  Bolsa 1 kg $ 145.webp', 1),
(78, 'Tiburones Lucky Gummy 1kg',       'gomitas',    105, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Tiburones - Lucky Gummy  Bolsa 1 kg $105.webp', 0),
(79, 'Tiburones Crazy Gummy 1kg',       'gomitas',    130, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/Gomitas Tiburones Crazy Gummy Sabores Surtidos 1 kg $130.webp', 0),
(80, 'Mini Jelly Huevito 20pz',         'gomitas',     60, 'img/productos/Gomitas-20260528T212326Z-3-001/Gomitas/HUBIN MINI JELLY HUEVITO 20pzs $60.webp', 0),
(81, 'Mazapán Chico 60pz',              'mazapanes',  100, 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN CHICO 60pz $100.webp', 1),
(82, 'Mazapán Chocolate 16pz',          'mazapanes',   80, 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN CHOCOLATE 16pz $80.webp', 0),
(83, 'Mazapán en Polvo 908gr',          'mazapanes',  120, 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN EN POLVO 908gr $120.webp', 0),
(84, 'Mazapán Gigante 20pz',            'mazapanes',  120, 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN GIGANTE 20pz $120.webp', 1),
(85, 'Mazapán Gigante Choc 12pz',       'mazapanes',  145, 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN GTE CHOC 12pz $145.webp', 0),
(86, 'Mazapán Original 12pz',           'mazapanes',   50, 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN ORIG 12pz $ 50.webp', 0),
(87, 'Mazapán Original 30pz',           'mazapanes',  110, 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/DLR MAZAPAN ORIG 30pz $110.webp', 0),
(88, 'Montes Mazapán 30pz',             'mazapanes',   90, 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/MONTES MAZAPÁN 30pz $90.webp', 0),
(89, 'Nestlé Crunch Mazapán 15pz',      'mazapanes',   75, 'img/productos/Mazapanes-20260528T212335Z-3-001/Mazapanes/NESTLE CRUNCH MAZAPAN 15pz $75.webp', 1),
(90, 'Coronado Paletón 10pz',           'paletas',     25, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/CORONADO PALETON 10pz $25.webp', 0),
(91, 'Paleta Maxi Jumbo 150pz',         'paletas',    115, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/DLR PAL.MAXI JUMBO 150pzs $115.webp', 1),
(92, 'Peloneta Chamoy Sandía 18pz',     'paletas',    103, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/HYS PELONETA CHAMSAN 18pz $103.webp', 0),
(93, 'Peloneta Tamarindo Mango 18pz',   'paletas',    103, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/HYS PELONETA TAMMGO 18pz $103.webp', 0),
(94, 'Calaveritas Neón 24pz',           'paletas',     81, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paleta Calaveritas Neón 24 piezas Display $81.webp', 0),
(95, 'Chupa Chups Chocolate 40pz',      'paletas',    122, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas Chupa-Chups Chocolate  Bolsa 40 pzas 480 g $122.webp', 1),
(96, 'Chupa Chups Cremosas 40pz',       'paletas',    122, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas Chupa-Chups Cremosas  Bolsa 40 pzas 480 g $122.webp', 0),
(97, 'Escobón Sandía Chile 40pz',       'paletas',     55, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas Escobón sandía con Chile  Bolsa 40 pzas 320 g $55.webp', 0),
(98, 'Rockaleta Junior 20pz',           'paletas',     87, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas Rockaleta Junior  Bolsa 20 pzas 250 g $87.webp', 0),
(99, 'Tropimango Chile 40pz',           'paletas',     87, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas sabor Mango con Chile - Tropimango  Bolsa 40 pzas 560 g $87.webp', 1),
(100,'Piña Caribeña Chile 40pz',        'paletas',     88, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/Paletas saborpiña con Chile -piña Caribeña  Bolsa 40 pzas 560 g $88.webp', 0),
(101,'Sonrics Tixtix 30pz',             'paletas',     75, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/SONRIC_S PALETA TIXTIX 30pz $75.webp', 0),
(102,'Vero Paleta Elote 40pz',          'paletas',     92, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL ELOTE 40pz  $92.webp', 0),
(103,'Vero Paleta Manita 40pz',         'paletas',     92, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL MANITA 40pz $92.webp', 0),
(104,'Vero Pintazul 10pz',              'paletas',     65, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL MARBETE PINTAZUL 10pz $65.webp', 0),
(105,'Vero Semaforito 40pz',            'paletas',     92, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL SEMAFORITO 40pz $92.webp', 0),
(106,'Vero Bomba Negra 40pz',           'paletas',     82, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL.BOMBA NEGRA 40pzs $82.webp', 0),
(107,'Vero Brochita Pintazul 48pz',     'paletas',     92, 'img/productos/Paletas-20260528T212337Z-3-001/Paletas/VERO PAL.BROCHITA PINTAZUL 48pzs $92.webp', 1);

-- ============================================================
--  TRIGGERS — bitácora automática en "auditoria"
--  Aportados por Eduardo, integrados aquí el 31-jul-2026.
--  Se crean DESPUÉS de insertar los 107 productos a propósito,
--  para que el seed inicial no llene "auditoria" con 107 filas
--  de "se agregó el producto..." en cada instalación nueva.
--
--  COLUMNA "usuario" (agregado 13-ago-2026, hallazgo de la guía de
--  estudio): antes esta columna existía pero ningún trigger la
--  llenaba, así que nunca se sabía QUIÉN hizo un cambio, solo qué
--  cambió — un problema real si hay varios admins. Un trigger no
--  puede saber por sí solo qué admin de la página disparó el
--  cambio (todos comparten la misma conexión a MySQL), así que el
--  backend deja una pista justo antes de la consulta, con una
--  variable de sesión: SET @app_usuario = 'Gera (gera@ejemplo.com)'
--  (ver db.js → conActor). Cada trigger la lee con COALESCE(...,
--  'sistema'): si nadie la dejó (ej. un cambio hecho a mano desde
--  Workbench, o un proceso automático como las alertas de stock),
--  se guarda 'sistema' en vez de dejarlo vacío.
-- ============================================================
DELIMITER $$

DROP TRIGGER IF EXISTS tr_productos_insert$$
CREATE TRIGGER tr_productos_insert
AFTER INSERT ON productos
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (tabla_afectada, accion, id_registro, usuario, descripcion, datos_nuevos)
  VALUES ('productos', 'INSERT', NEW.id, COALESCE(@app_usuario, 'sistema'),
    CONCAT('Se agregó el producto: ', NEW.nombre),
    JSON_OBJECT('nombre', NEW.nombre, 'categoria', NEW.categoria, 'precio', NEW.precio, 'stock', NEW.stock));
END$$

DROP TRIGGER IF EXISTS tr_productos_update$$
CREATE TRIGGER tr_productos_update
AFTER UPDATE ON productos
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (tabla_afectada, accion, id_registro, usuario, descripcion, datos_anteriores, datos_nuevos)
  VALUES ('productos', 'UPDATE', NEW.id, COALESCE(@app_usuario, 'sistema'),
    CONCAT('Se actualizó el producto: ', NEW.nombre),
    JSON_OBJECT('nombre', OLD.nombre, 'categoria', OLD.categoria, 'precio', OLD.precio, 'stock', OLD.stock, 'activo', OLD.activo),
    JSON_OBJECT('nombre', NEW.nombre, 'categoria', NEW.categoria, 'precio', NEW.precio, 'stock', NEW.stock, 'activo', NEW.activo));
END$$

DROP TRIGGER IF EXISTS tr_productos_delete$$
CREATE TRIGGER tr_productos_delete
AFTER DELETE ON productos
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (tabla_afectada, accion, id_registro, usuario, descripcion, datos_anteriores)
  VALUES ('productos', 'DELETE', OLD.id, COALESCE(@app_usuario, 'sistema'),
    CONCAT('Se eliminó el producto: ', OLD.nombre),
    JSON_OBJECT('nombre', OLD.nombre, 'categoria', OLD.categoria, 'precio', OLD.precio, 'stock', OLD.stock));
END$$

DROP TRIGGER IF EXISTS tr_pedidos_insert$$
CREATE TRIGGER tr_pedidos_insert
AFTER INSERT ON pedidos
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (tabla_afectada, accion, id_registro, usuario, descripcion, datos_nuevos)
  VALUES ('pedidos', 'INSERT', NEW.id, COALESCE(@app_usuario, 'sistema'),
    CONCAT('Nuevo pedido #', NEW.id),
    JSON_OBJECT('usuario', NEW.usuario_id, 'total', NEW.total, 'estado', NEW.estado));
END$$

DROP TRIGGER IF EXISTS tr_pedidos_update$$
CREATE TRIGGER tr_pedidos_update
AFTER UPDATE ON pedidos
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (tabla_afectada, accion, id_registro, usuario, descripcion, datos_anteriores, datos_nuevos)
  VALUES ('pedidos', 'UPDATE', NEW.id, COALESCE(@app_usuario, 'sistema'),
    CONCAT('Pedido #', NEW.id, ' actualizado'),
    JSON_OBJECT('estado', OLD.estado, 'total', OLD.total),
    JSON_OBJECT('estado', NEW.estado, 'total', NEW.total));
END$$

DROP TRIGGER IF EXISTS tr_usuarios_insert$$
CREATE TRIGGER tr_usuarios_insert
AFTER INSERT ON usuarios
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (tabla_afectada, accion, id_registro, usuario, descripcion, datos_nuevos)
  VALUES ('usuarios', 'INSERT', NEW.id, COALESCE(@app_usuario, 'sistema'),
    CONCAT('Nuevo usuario registrado: ', NEW.nombre),
    JSON_OBJECT('nombre', NEW.nombre, 'email', NEW.email, 'rol', NEW.rol));
END$$

DROP TRIGGER IF EXISTS tr_usuarios_update$$
CREATE TRIGGER tr_usuarios_update
AFTER UPDATE ON usuarios
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (tabla_afectada, accion, id_registro, usuario, descripcion, datos_anteriores, datos_nuevos)
  VALUES ('usuarios', 'UPDATE', NEW.id, COALESCE(@app_usuario, 'sistema'),
    CONCAT('Usuario actualizado: ', NEW.nombre),
    JSON_OBJECT('nombre', OLD.nombre, 'email', OLD.email, 'rol', OLD.rol),
    JSON_OBJECT('nombre', NEW.nombre, 'email', NEW.email, 'rol', NEW.rol));
END$$

-- NOTA (agregado 31-jul-2026, no estaba en el archivo original de Eduardo):
-- backend/routes/usuarios.js sí hace un DELETE real de usuarios (a
-- diferencia de productos, que solo hace soft-delete) — sin este trigger
-- esa acción se quedaba fuera de la bitácora de auditoría.
DROP TRIGGER IF EXISTS tr_usuarios_delete$$
CREATE TRIGGER tr_usuarios_delete
AFTER DELETE ON usuarios
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (tabla_afectada, accion, id_registro, usuario, descripcion, datos_anteriores)
  VALUES ('usuarios', 'DELETE', OLD.id, COALESCE(@app_usuario, 'sistema'),
    CONCAT('Usuario eliminado: ', OLD.nombre),
    JSON_OBJECT('nombre', OLD.nombre, 'email', OLD.email, 'rol', OLD.rol));
END$$

DELIMITER ;

-- ============================================================
--  PROCEDIMIENTOS ALMACENADOS
--  Aportados por Eduardo, integrados aquí el 31-jul-2026.
--  Son utilidades para usar directo desde MySQL Workbench; el
--  backend Node.js no los llama (sigue usando sus propias rutas
--  con las validaciones de negocio de TRANSICIONES_VALIDAS,
--  protección de último admin, etc. — estos procedimientos NO
--  reemplazan esas reglas si se llaman a mano).
-- ============================================================

/* sp_cambiar_estado_pedido(p_id, p_estado)
   Cambia el estado de un pedido y muestra su info actualizada.
   Ejemplo: CALL sp_cambiar_estado_pedido(5, 'entregado'); */
DELIMITER $$
DROP PROCEDURE IF EXISTS sp_cambiar_estado_pedido$$
CREATE PROCEDURE sp_cambiar_estado_pedido(IN p_id INT, IN p_estado VARCHAR(30))
BEGIN
  UPDATE pedidos SET estado = p_estado WHERE id = p_id;
  SELECT p.id AS pedido, u.nombre AS cliente, p.total, p.estado,
         p.metodo_pago, p.nombre_envio, p.telefono, p.fecha
  FROM pedidos p INNER JOIN usuarios u ON p.usuario_id = u.id
  WHERE p.id = p_id;
END$$
DELIMITER ;

/* sp_productos_stock_bajo()
   Lista los productos cuyo stock ya llegó a su stock_minimo o menos.
   Ejemplo: CALL sp_productos_stock_bajo(); */
DELIMITER $$
DROP PROCEDURE IF EXISTS sp_productos_stock_bajo$$
CREATE PROCEDURE sp_productos_stock_bajo()
BEGIN
  SELECT id, nombre, categoria, stock, stock_minimo
  FROM productos
  WHERE stock <= stock_minimo
  ORDER BY stock ASC;
END$$
DELIMITER ;

/* sp_cambiar_rol_usuario(p_usuario, p_rol)
   Cambia el rol de un usuario entre cliente y admin.
   Ejemplo: CALL sp_cambiar_rol_usuario(3, 'admin'); */
DELIMITER $$
DROP PROCEDURE IF EXISTS sp_cambiar_rol_usuario$$
CREATE PROCEDURE sp_cambiar_rol_usuario(IN p_usuario INT, IN p_rol VARCHAR(20))
BEGIN
  UPDATE usuarios SET rol = p_rol WHERE id = p_usuario;
END$$
DELIMITER ;

-- ============================================================
--  VISTAS
--  Aportadas por Eduardo, integradas aquí el 31-jul-2026.
-- ============================================================

-- Productos cuyo stock ya llegó a su stock_minimo o menos.
DROP VIEW IF EXISTS vw_productos_stock_bajo;
CREATE VIEW vw_productos_stock_bajo AS
SELECT id, nombre, categoria, precio, stock, stock_minimo
FROM productos
WHERE stock <= stock_minimo;

-- Pedidos con los datos del cliente ya unidos (para reportes/admin).
DROP VIEW IF EXISTS vw_pedidos_completos;
CREATE VIEW vw_pedidos_completos AS
SELECT p.id AS pedido, u.nombre AS cliente, u.email, p.total, p.estado,
       p.metodo_pago, p.nombre_envio, p.telefono, p.fecha
FROM pedidos p INNER JOIN usuarios u ON p.usuario_id = u.id;

-- Solo los productos activos (disponibles para la venta).
DROP VIEW IF EXISTS vw_catalogo;
CREATE VIEW vw_catalogo AS
SELECT id, nombre, categoria, precio, stock, imagen, destacado
FROM productos
WHERE activo = 1;
