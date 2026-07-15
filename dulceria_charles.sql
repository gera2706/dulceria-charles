-- ============================================================
--  DULCERÍA CHARLES — Esquema de base de datos
--  MySQL 8.x  |  Ejecutar en MySQL Workbench
--
--  Este es el ÚNICO archivo .sql del proyecto. Al ejecutarlo completo
--  (Ctrl+Shift+Enter en Workbench) BORRA la base de datos si ya
--  existía y la vuelve a crear desde cero, siempre con el esquema
--  más reciente (incluye stock, proveedor, etc.).
--
--  ⚠️ ADVERTENCIA: esto BORRA todo lo que haya en dulceria_charles
--  (usuarios, pedidos, productos que hayas agregado tú). Úsalo solo
--  cuando quieras reiniciar la base de datos desde cero.
-- ============================================================

DROP DATABASE IF EXISTS dulceria_charles;

CREATE DATABASE dulceria_charles
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE dulceria_charles;

-- ── USUARIOS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(100)  NOT NULL,
  email          VARCHAR(150)  NOT NULL UNIQUE,
  password       VARCHAR(255)  NOT NULL,
  rol            ENUM('cliente','admin') DEFAULT 'cliente',
  fecha_registro DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── PRODUCTOS ─────────────────────────────────────────────
-- categoria es VARCHAR para que las categorías dinámicas del admin funcionen.
-- No usar ENUM aquí porque rompe al crear categorías nuevas desde el panel.
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
  fecha_creacion  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activo_cat (activo, categoria),
  INDEX idx_destacado  (destacado)
) ENGINE=InnoDB;

-- ── CUPONES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cupones (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  codigo      VARCHAR(50)   NOT NULL UNIQUE,
  tipo        ENUM('percent','fixed') NOT NULL,
  valor       DECIMAL(10,2) NOT NULL,
  descripcion VARCHAR(200),
  activo      TINYINT(1)    DEFAULT 1
) ENGINE=InnoDB;

-- ── PEDIDOS ───────────────────────────────────────────────
-- Modelo pickup: el cliente recoge en tienda, no hay dirección de envío.
-- Estados alineados con el backend (routes/pedidos.js).
CREATE TABLE IF NOT EXISTS pedidos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id    INT           NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL,
  descuento     DECIMAL(10,2) DEFAULT 0,
  cupon         VARCHAR(50),
  total         DECIMAL(10,2) NOT NULL,
  estado        ENUM('pendiente_finalizar','pendiente_entregar','entregado','cancelado')
                DEFAULT 'pendiente_finalizar',
  metodo_pago   VARCHAR(50),
  nombre_envio  VARCHAR(150),
  telefono      VARCHAR(20),
  fecha         DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
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
  FOREIGN KEY (pedido_id)   REFERENCES pedidos(id)   ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL,
  INDEX idx_pedido_id (pedido_id)
) ENGINE=InnoDB;

-- ── FAVORITOS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favoritos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT  NOT NULL,
  producto_id  INT  NOT NULL,
  fecha        DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_fav (usuario_id, producto_id),
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  INDEX idx_usuario_id (usuario_id)
) ENGINE=InnoDB;

-- ============================================================
--  DATOS INICIALES
-- ============================================================

-- Admin  (password: admin123)
-- IMPORTANTE: Cambiar la contraseña antes de producción real.
INSERT INTO usuarios (nombre, email, password, rol) VALUES
('Administrador', 'admin@dulceriacharles.com',
 '$2a$10$.lVaHAere803JSviyRCNneVSVnEKnyPCzt2sDr7pqVoy50//wVS2i', 'admin');

-- Cupones
INSERT INTO cupones (codigo, tipo, valor, descripcion) VALUES
('CHOCO20',       'percent', 20,  '20% de descuento en chocolates'),
('BIENVENIDO',    'fixed',   30,  '$30 de descuento'),
('CHARLES10',     'percent', 10,  '10% de descuento'),
('DULCE10',       'percent', 10,  '10% de descuento'),
('CHARLES20',     'percent', 20,  '20% de descuento'),
('NAVIDAD25',     'percent', 25,  '25% de descuento navideño'),
('PRIMERACOMPRA', 'percent', 15,  '15% bienvenida primera compra'),
('SWEET50',       'fixed',   50,  '$50 de descuento'),
('CHARLES100',    'fixed',   100, '$100 de descuento');

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
