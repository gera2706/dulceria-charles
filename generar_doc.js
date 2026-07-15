const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents
} = require('C:/Users/gera_/AppData/Roaming/npm/node_modules/docx');
const fs = require('fs');

// ── Helpers ──────────────────────────────────────────────────────────
const PINK   = 'C2185B';
const LPINK  = 'FCE4EC';
const DGRAY  = '37474F';
const LGRAY  = 'ECEFF1';
const WHITE  = 'FFFFFF';
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const W = 9360; // content width DXA (Letter 1" margins)

function pb() { return new Paragraph({ children: [new PageBreak()] }); }

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 36, color: PINK, font: 'Arial' })]
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28, color: DGRAY, font: 'Arial' })]
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24, color: DGRAY, font: 'Arial' })]
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text, size: 22, font: 'Arial', ...opts })]
  });
}
function pBold(text) { return p(text, { bold: true }); }
function blank() { return new Paragraph({ spacing: { after: 80 }, children: [] }); }

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, font: 'Arial' })]
  });
}
function numbered(text) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, font: 'Arial' })]
  });
}

// Header row helper
function thRow(cols, widths) {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c, i) =>
      new TableCell({
        borders: BORDERS,
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: PINK, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: c, bold: true, color: WHITE, size: 20, font: 'Arial' })]
        })]
      })
    )
  });
}
function tdRow(cols, widths, shade = false) {
  return new TableRow({
    children: cols.map((c, i) =>
      new TableCell({
        borders: BORDERS,
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: shade ? LGRAY : WHITE, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: String(c), size: 20, font: 'Arial' })]
        })]
      })
    )
  });
}

function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      thRow(headers, widths),
      ...rows.map((r, i) => tdRow(r, widths, i % 2 === 0))
    ]
  });
}

// ── CONTENIDO ────────────────────────────────────────────────────────
const sections_children = [];

// ═══════════════════════════════════════════════════════════
// PORTADA
// ═══════════════════════════════════════════════════════════
sections_children.push(
  blank(), blank(), blank(), blank(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: '🍬 Dulcería Charles', bold: true, size: 72, color: PINK, font: 'Arial' })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: 'Sistema Web de Venta en Línea', size: 40, color: DGRAY, font: 'Arial' })]
  }),
  blank(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PINK } },
    spacing: { after: 300 },
    children: []
  }),
  blank(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: 'DOCUMENTACIÓN TÉCNICA Y DE USUARIO', bold: true, size: 28, color: DGRAY, font: 'Arial' })] }),
  blank(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: 'Versión 1.0', size: 24, font: 'Arial', color: DGRAY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: 'Fecha: Junio 2026', size: 24, font: 'Arial', color: DGRAY })] }),
  blank(), blank(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: 'Proyecto Integrado — Ingeniería en Sistemas / Desarrollo Web', size: 22, font: 'Arial', color: DGRAY })] }),
  blank(), blank(), blank(),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // ÍNDICE
  // ═══════════════════════════════════════════════════════════
  new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: 'ÍNDICE', bold: true, size: 36, color: PINK, font: 'Arial' })] }),
  ...['1. Introducción','2. Objetivos','3. Justificación','4. Alcance del Proyecto',
      '5. Análisis del Sistema','6. Requerimientos','7. Tecnologías Utilizadas',
      '8. Arquitectura del Sistema','9. Base de Datos','10. Módulos del Sistema',
      '11. API REST — Endpoints','12. Seguridad','13. Manual Técnico de Instalación',
      '14. Manual de Usuario','15. Diagramas del Sistema','16. Pruebas Realizadas',
      '17. Problemas Encontrados y Soluciones','18. Conclusiones',
      '19. Recomendaciones','20. Anexos'].map(t => p(t)),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 1. INTRODUCCIÓN
  // ═══════════════════════════════════════════════════════════
  h1('1. Introducción'),
  p('Dulcería Charles es un sistema web de comercio electrónico desarrollado para gestionar la venta en línea de productos de dulcería, botanas y chocolates. La plataforma permite a los clientes explorar el catálogo de productos, agregar artículos al carrito de compras, aplicar cupones de descuento y realizar pedidos en línea bajo el modelo pickup (recoger en tienda).'),
  p('El sistema fue desarrollado como un proyecto integrador académico con el objetivo de aplicar los conocimientos adquiridos en el área de desarrollo web, bases de datos, arquitectura de software y seguridad informática.'),
  blank(),
  h2('Problema que resuelve'),
  p('Las dulcerías y tiendas de abarrotes pequeñas en México generalmente operan de forma presencial, sin posibilidad de que sus clientes consulten el catálogo, conozcan los precios actualizados o realicen pedidos previos desde casa. Esto limita su alcance y genera pérdidas de ventas fuera del horario de atención.'),
  p('Dulcería Charles soluciona este problema ofreciendo una tienda virtual disponible las 24 horas, con catálogo dinámico, sistema de pedidos y panel de administración integrado.'),
  blank(),
  h2('Beneficios'),
  bullet('Acceso al catálogo desde cualquier dispositivo con navegador web.'),
  bullet('Reducción del tiempo de atención presencial mediante pedidos previos.'),
  bullet('Control administrativo completo sin conocimientos técnicos avanzados.'),
  bullet('Historial de compras disponible para el cliente en todo momento.'),
  bullet('Sistema de cupones para estrategias de fidelización y promoción.'),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 2. OBJETIVOS
  // ═══════════════════════════════════════════════════════════
  h1('2. Objetivos'),
  h2('Objetivo General'),
  p('Desarrollar un sistema web completo de comercio electrónico para Dulcería Charles que permita la gestión integral del catálogo de productos, el proceso de compra en línea y la administración del negocio mediante un panel de control seguro y accesible.'),
  blank(),
  h2('Objetivos Específicos'),
  numbered('Implementar un módulo de autenticación seguro con registro, inicio de sesión y gestión de sesiones mediante tokens JWT.'),
  numbered('Desarrollar un catálogo de productos dinámico con filtros por categoría, precio y búsqueda por nombre.'),
  numbered('Crear un sistema de carrito de compras persistente que permita al usuario agregar, eliminar y modificar productos.'),
  numbered('Implementar un flujo de pedidos completo desde la selección de productos hasta la confirmación y generación del comprobante.'),
  numbered('Desarrollar un panel de administración que permita gestionar productos, categorías, pedidos, usuarios y cupones sin necesidad de conocimientos técnicos.'),
  numbered('Aplicar medidas de seguridad como cifrado de contraseñas, protección contra SQL Injection, control de acceso por roles y limitación de peticiones.'),
  numbered('Diseñar y optimizar la base de datos con índices, relaciones íntegras y consultas eficientes.'),
  numbered('Implementar un sistema de cupones de descuento que soporte tanto descuentos porcentuales como descuentos de monto fijo.'),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 3. JUSTIFICACIÓN
  // ═══════════════════════════════════════════════════════════
  h1('3. Justificación'),
  p('El comercio electrónico ha experimentado un crecimiento exponencial en los últimos años, especialmente en el sector de alimentos y bebidas. Sin embargo, muchos negocios pequeños y medianos en México aún no cuentan con una presencia digital que les permita competir en este entorno.'),
  p('Dulcería Charles representa un negocio con potencial de crecimiento que se ve limitado por la ausencia de herramientas digitales. La implementación de este sistema web permite:'),
  bullet('Al cliente: consultar el catálogo completo con precios actualizados, realizar pedidos desde casa y conocer el estado de su compra en tiempo real.'),
  bullet('Al administrador: gestionar el inventario visual, controlar los pedidos sin papel, aplicar descuentos estratégicos y conocer las estadísticas del negocio.'),
  bullet('Al negocio: reducir errores en pedidos, ampliar el horario de ventas efectivo y mejorar la experiencia del cliente.'),
  p('Desde el punto de vista académico, este proyecto justifica la integración de múltiples áreas del conocimiento: programación web, bases de datos relacionales, seguridad informática, arquitectura de software y diseño de interfaces de usuario.'),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 4. ALCANCE
  // ═══════════════════════════════════════════════════════════
  h1('4. Alcance del Proyecto'),
  h2('Qué incluye el sistema'),
  bullet('Portal web para clientes con catálogo, carrito, pedidos y favoritos.'),
  bullet('Sistema de autenticación y gestión de cuentas de usuario.'),
  bullet('Panel de administración completo (productos, categorías, pedidos, usuarios, cupones, configuración).'),
  bullet('API REST que expone 25 endpoints documentados.'),
  bullet('Base de datos relacional con 8 tablas optimizadas.'),
  bullet('Subida y gestión de imágenes de productos y categorías.'),
  bullet('Sistema de cupones con descuento porcentual y de monto fijo.'),
  blank(),
  h2('Limitaciones actuales'),
  bullet('No incluye pasarela de pago real (el pago se registra como método seleccionado pero no se procesa en línea).'),
  bullet('Modelo pickup exclusivamente: no contempla envío a domicilio.'),
  bullet('No incluye notificaciones por correo electrónico.'),
  bullet('No cuenta con sistema de reseñas o calificaciones de productos.'),
  bullet('No incluye control de inventario ni manejo de stock.'),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 5. ANÁLISIS DEL SISTEMA
  // ═══════════════════════════════════════════════════════════
  h1('5. Análisis del Sistema'),
  h2('Roles de Usuario'),
  table(
    ['Rol','Descripción','Permisos'],
    [
      ['Cliente','Usuario registrado que realiza compras.','Navegar catálogo, carrito, pedidos, favoritos.'],
      ['Administrador','Gestor del negocio con acceso total.','Todo lo del cliente + panel de administración.'],
      ['Visitante','Usuario sin cuenta registrada.','Solo puede ver el catálogo y contacto.'],
    ],
    [1800, 3600, 3960]
  ),
  blank(),
  h2('Flujo de Trabajo del Cliente'),
  numbered('El visitante accede al sitio y explora el catálogo de productos.'),
  numbered('Filtra por categoría, precio o búsqueda y agrega productos al carrito.'),
  numbered('Si desea comprar, inicia sesión o se registra.'),
  numbered('En la pantalla de pago aplica un cupón (opcional) e ingresa sus datos.'),
  numbered('El sistema registra el pedido como "pendiente_finalizar" al ingresar a pago.'),
  numbered('Al confirmar, el estado cambia a "pendiente_entregar".'),
  numbered('Se genera un comprobante con el número de pedido.'),
  numbered('El cliente acude a la tienda y recoge su pedido.'),
  numbered('El administrador marca el pedido como "entregado".'),
  blank(),
  h2('Flujo de Trabajo del Administrador'),
  numbered('Accede al panel de administración con credenciales de administrador.'),
  numbered('Consulta el dashboard con estadísticas generales.'),
  numbered('Gestiona el catálogo: agrega, edita o desactiva productos.'),
  numbered('Administra las categorías con emojis o imágenes personalizadas.'),
  numbered('Revisa los pedidos entrantes y actualiza su estado.'),
  numbered('Gestiona los usuarios registrados y sus roles.'),
  numbered('Crea o desactiva cupones de descuento.'),
  numbered('Actualiza la información de contacto del sitio.'),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 6. REQUERIMIENTOS
  // ═══════════════════════════════════════════════════════════
  h1('6. Requerimientos'),
  h2('Requerimientos Funcionales'),
  table(
    ['ID','Descripción','Rol'],
    [
      ['RF-01','Registrar cuenta con nombre, email y contraseña.','Cliente'],
      ['RF-02','Iniciar sesión con autenticación JWT.','Cliente/Admin'],
      ['RF-03','Verificar sesión activa al recargar la página.','Cliente/Admin'],
      ['RF-04','Listar productos del catálogo con paginación visual.','Visitante'],
      ['RF-05','Filtrar productos por categoría.','Visitante'],
      ['RF-06','Filtrar productos por precio máximo.','Visitante'],
      ['RF-07','Buscar productos por nombre (texto libre).','Visitante'],
      ['RF-08','Agregar y quitar productos del carrito.','Cliente'],
      ['RF-09','Ver resumen del carrito con subtotal y cantidades.','Cliente'],
      ['RF-10','Aplicar cupón de descuento (porcentaje o monto fijo).','Cliente'],
      ['RF-11','Completar pedido con nombre, teléfono y método de pago.','Cliente'],
      ['RF-12','Guardar pedido inconcluso al entrar a pago.','Cliente'],
      ['RF-13','Ver comprobante del pedido tras confirmar.','Cliente'],
      ['RF-14','Consultar historial de pedidos propios con estado.','Cliente'],
      ['RF-15','Agregar y quitar productos de favoritos.','Cliente'],
      ['RF-16','Ver productos destacados en la página principal.','Visitante'],
      ['RF-17','Ver información de contacto de la dulcería.','Visitante'],
      ['RF-18','Gestionar productos: crear, editar, eliminar.','Admin'],
      ['RF-19','Gestionar categorías dinámicas con emoji o imagen.','Admin'],
      ['RF-20','Subir imágenes para productos y categorías.','Admin'],
      ['RF-21','Ver y gestionar todos los pedidos con cambio de estado.','Admin'],
      ['RF-22','Gestionar usuarios: ver lista, cambiar rol, eliminar.','Admin'],
      ['RF-23','Crear y gestionar cupones de descuento.','Admin'],
      ['RF-24','Configurar datos de contacto del sitio.','Admin'],
      ['RF-25','Ver dashboard con estadísticas del negocio.','Admin'],
    ],
    [900, 5760, 2700]
  ),
  blank(),
  h2('Requerimientos No Funcionales'),
  table(
    ['ID','Categoría','Descripción'],
    [
      ['RNF-01','Seguridad','Contraseñas cifradas con bcrypt, tokens JWT firmados, roles verificados en el servidor.'],
      ['RNF-02','Rendimiento','Pool de conexiones MySQL, consultas JOIN sin N+1, índices en columnas de búsqueda frecuente.'],
      ['RNF-03','Usabilidad','Interfaz responsiva, mensajes de error claros, confirmaciones visuales toast.'],
      ['RNF-04','Compatibilidad','Compatible con Chrome, Firefox, Edge y Safari modernos.'],
      ['RNF-05','Escalabilidad','Arquitectura REST stateless, categorías dinámicas extensibles sin cambios de código.'],
      ['RNF-06','Mantenibilidad','Código separado por módulos, rutas en archivos independientes, variables de entorno.'],
      ['RNF-07','Disponibilidad','Servidor Node.js con manejo de errores en todas las rutas para evitar caídas.'],
    ],
    [1100, 1800, 6460]
  ),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 7. TECNOLOGÍAS
  // ═══════════════════════════════════════════════════════════
  h1('7. Tecnologías Utilizadas'),
  h2('Frontend'),
  table(
    ['Tecnología','Versión','Uso en el proyecto'],
    [
      ['HTML5','5','Estructura semántica de todas las páginas del sitio.'],
      ['CSS3','3','Estilos, variables CSS, diseño responsivo, animaciones.'],
      ['JavaScript','ES6+','Interactividad, consumo de API REST, manejo del DOM.'],
    ],
    [2000, 1200, 6160]
  ),
  blank(),
  h2('Backend'),
  table(
    ['Tecnología','Versión','Uso en el proyecto'],
    [
      ['Node.js','18+','Entorno de ejecución JavaScript del lado del servidor.'],
      ['Express','4.x','Framework HTTP para definir rutas y middleware.'],
      ['mysql2','3.x','Driver para comunicación con MySQL con soporte async/await.'],
      ['bcryptjs','2.4.x','Cifrado seguro de contraseñas con algoritmo bcrypt.'],
      ['jsonwebtoken','9.x','Generación y verificación de tokens JWT para autenticación.'],
      ['multer','2.x','Manejo de subida de archivos multipart/form-data.'],
      ['dotenv','16.x','Gestión de variables de entorno desde archivo .env.'],
      ['cors','2.x','Control de Cross-Origin Resource Sharing.'],
      ['express-rate-limit','—','Límite de peticiones por IP para prevenir fuerza bruta.'],
      ['nodemon','3.x','Recarga automática del servidor en desarrollo.'],
    ],
    [2400, 1200, 5760]
  ),
  blank(),
  h2('Base de Datos'),
  table(
    ['Tecnología','Versión','Uso en el proyecto'],
    [
      ['MySQL','8.x','Sistema gestor de base de datos relacional principal.'],
      ['InnoDB','—','Motor de almacenamiento con soporte para transacciones y claves foráneas.'],
    ],
    [2000, 1200, 6160]
  ),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 8. ARQUITECTURA
  // ═══════════════════════════════════════════════════════════
  h1('8. Arquitectura del Sistema'),
  p('El sistema sigue una arquitectura de tres capas clásica con comunicación mediante API REST:'),
  blank(),
  h2('Capa de Presentación (Frontend)'),
  p('El frontend está compuesto por archivos HTML, CSS y JavaScript estáticos servidos directamente por Express. No utiliza framework frontend (React, Vue, etc.); toda la interactividad se logra mediante JavaScript vanilla y el consumo de la API REST mediante la función nativa fetch().'),
  p('Cada página tiene su propio archivo JavaScript (catalogo.js, index.js, admin.js, etc.) y comparte módulos comunes como api.js (comunicación con el servidor), auth.js (sesión del cliente) y cart.js (carrito de compras en localStorage).'),
  blank(),
  h2('Capa de Lógica de Negocio (Backend)'),
  p('El backend está construido con Node.js y Express. Expone una API REST con el prefijo /api/ que el frontend consume mediante peticiones HTTP. Cada recurso tiene su propio archivo de rutas (routes/) y el servidor central (server.js) los registra con su prefijo correspondiente.'),
  p('La autenticación se maneja mediante JSON Web Tokens (JWT). El middleware de autenticación (authMiddleware) verifica el token en cada petición protegida, y el middleware de administración (adminMiddleware) verifica adicionalmente el rol del usuario.'),
  blank(),
  h2('Capa de Datos (Base de Datos)'),
  p('MySQL 8.x almacena todos los datos del sistema en 8 tablas relacionadas: usuarios, productos, categorias, pedidos, pedido_items, cupones, favoritos y configuracion. Se utiliza el motor InnoDB para garantizar integridad referencial mediante claves foráneas y soporte para transacciones ACID en operaciones críticas como la creación de pedidos.'),
  blank(),
  h2('Diagrama de Arquitectura'),
  p('[ Navegador ] ─ HTTP/HTTPS ─► [ Node.js + Express (Puerto 3000) ] ─ SQL ─► [ MySQL ]'),
  p('El servidor Express cumple doble función: sirve los archivos estáticos del frontend y expone la API REST. Esto simplifica el despliegue al requerir un único proceso de servidor.'),
  blank(),
  h2('Estructura de Carpetas'),
  table(
    ['Carpeta/Archivo','Descripción'],
    [
      ['index.html, catalogo.html...','Páginas HTML del frontend.'],
      ['css/','Hojas de estilo por página.'],
      ['js/','Scripts JavaScript del frontend.'],
      ['img/','Imágenes de productos y categorías.'],
      ['backend/server.js','Punto de entrada del servidor.'],
      ['backend/db.js','Configuración del pool de conexiones MySQL.'],
      ['backend/middleware/auth.js','Middleware de autenticación y autorización.'],
      ['backend/routes/','Archivos de rutas por recurso (auth, productos, pedidos...).'],
      ['backend/.env','Variables de entorno (credenciales, secretos).'],
      ['backend/migrations/','Scripts de migración de base de datos archivados.'],
      ['dulceria_charles.sql','Esquema completo de la base de datos.'],
      ['migracion_auditoria.sql','Script para aplicar cambios a BD existente.'],
    ],
    [3500, 5860]
  ),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 9. BASE DE DATOS
  // ═══════════════════════════════════════════════════════════
  h1('9. Base de Datos'),
  p('La base de datos dulceria_charles está diseñada en MySQL 8.x con el motor InnoDB y codificación utf8mb4 para soporte completo de emojis y caracteres especiales.'),
  blank(),
  h2('9.1 Tabla: usuarios'),
  p('Almacena las cuentas de todos los usuarios del sistema, tanto clientes como administradores.'),
  table(
    ['Campo','Tipo','Restricciones','Descripción'],
    [
      ['id','INT','PK, AUTO_INCREMENT','Identificador único del usuario.'],
      ['nombre','VARCHAR(100)','NOT NULL','Nombre completo del usuario.'],
      ['email','VARCHAR(150)','NOT NULL, UNIQUE','Correo electrónico (usado para login).'],
      ['password','VARCHAR(255)','NOT NULL','Hash bcrypt de la contraseña.'],
      ['rol','ENUM','DEFAULT cliente','Rol del usuario: cliente o admin.'],
      ['fecha_registro','DATETIME','DEFAULT NOW()','Fecha y hora de creación de la cuenta.'],
    ],
    [1800, 1600, 2200, 3760]
  ),
  blank(),
  h2('9.2 Tabla: productos'),
  p('Catálogo completo de productos. Usa soft delete (campo activo) para preservar el historial de pedidos.'),
  table(
    ['Campo','Tipo','Restricciones','Descripción'],
    [
      ['id','INT','PK, AUTO_INCREMENT','Identificador único del producto.'],
      ['nombre','VARCHAR(200)','NOT NULL','Nombre del producto.'],
      ['categoria','VARCHAR(100)','NOT NULL, INDEX','Categoría a la que pertenece.'],
      ['precio','DECIMAL(10,2)','NOT NULL','Precio de venta en pesos mexicanos.'],
      ['imagen','VARCHAR(600)','NULL','Ruta relativa o URL de la imagen.'],
      ['destacado','TINYINT(1)','DEFAULT 0, INDEX','1 = aparece en página principal.'],
      ['activo','TINYINT(1)','DEFAULT 1','0 = eliminado (soft delete).'],
      ['proveedor','VARCHAR(150)','NULL','Nombre del proveedor (opcional).'],
      ['fecha_creacion','DATETIME','DEFAULT NOW()','Fecha de alta del producto.'],
    ],
    [1800, 1600, 2200, 3760]
  ),
  blank(),
  h2('9.3 Tabla: categorias'),
  p('Almacena las categorías del catálogo. Son dinámicas: el administrador puede crear, editar y eliminar categorías desde el panel sin modificar código.'),
  table(
    ['Campo','Tipo','Restricciones','Descripción'],
    [
      ['id','INT','PK, AUTO_INCREMENT','Identificador único de la categoría.'],
      ['nombre','VARCHAR(100)','NOT NULL, UNIQUE','Nombre de la categoría (en minúsculas).'],
      ['icono','VARCHAR(600)','NULL','Emoji (ej: 🍬) o ruta de imagen personalizada.'],
    ],
    [1800, 1600, 2200, 3760]
  ),
  blank(),
  h2('9.4 Tabla: pedidos'),
  p('Registra cada pedido realizado. Modelo pickup: no incluye dirección de envío.'),
  table(
    ['Campo','Tipo','Restricciones','Descripción'],
    [
      ['id','INT','PK, AUTO_INCREMENT','Número de pedido.'],
      ['usuario_id','INT','FK usuarios(id), INDEX','Cliente que realizó el pedido.'],
      ['subtotal','DECIMAL(10,2)','NOT NULL','Total antes de descuento.'],
      ['descuento','DECIMAL(10,2)','DEFAULT 0','Monto descontado por cupón.'],
      ['cupon','VARCHAR(50)','NULL','Código del cupón aplicado.'],
      ['total','DECIMAL(10,2)','NOT NULL','Monto final a pagar.'],
      ['estado','ENUM','INDEX','Estado actual del pedido.'],
      ['metodo_pago','VARCHAR(50)','NULL','Efectivo, tarjeta, transferencia, etc.'],
      ['nombre_envio','VARCHAR(150)','NULL','Nombre del cliente para el pedido.'],
      ['telefono','VARCHAR(20)','NULL','Teléfono de contacto del cliente.'],
      ['fecha','DATETIME','DEFAULT NOW()','Fecha y hora del pedido.'],
    ],
    [1800, 1600, 2200, 3760]
  ),
  blank(),
  p('Estados del pedido:'),
  bullet('pendiente_finalizar: el cliente entró a pago pero no confirmó aún.'),
  bullet('pendiente_entregar: pago confirmado, listo para recoger en tienda.'),
  bullet('entregado: el cliente recogió su pedido.'),
  bullet('cancelado: pedido cancelado.'),
  blank(),
  h2('9.5 Tabla: pedido_items'),
  p('Detalle de cada producto incluido en un pedido. El nombre y precio se copian al momento del pedido para preservar el historial aunque el producto cambie de precio o sea eliminado.'),
  table(
    ['Campo','Tipo','Restricciones','Descripción'],
    [
      ['id','INT','PK, AUTO_INCREMENT','Identificador único del item.'],
      ['pedido_id','INT','FK pedidos(id) CASCADE, INDEX','Pedido al que pertenece.'],
      ['producto_id','INT','FK productos(id) SET NULL','Referencia al producto (puede ser NULL si fue eliminado).'],
      ['nombre','VARCHAR(200)','NOT NULL','Nombre del producto al momento del pedido.'],
      ['precio','DECIMAL(10,2)','NOT NULL','Precio unitario al momento del pedido.'],
      ['cantidad','INT','NOT NULL','Número de unidades pedidas.'],
    ],
    [1800, 1600, 2200, 3760]
  ),
  blank(),
  h2('9.6 Tabla: cupones'),
  table(
    ['Campo','Tipo','Restricciones','Descripción'],
    [
      ['id','INT','PK, AUTO_INCREMENT','Identificador único del cupón.'],
      ['codigo','VARCHAR(50)','NOT NULL, UNIQUE','Código que ingresa el cliente (en mayúsculas).'],
      ['tipo','ENUM','NOT NULL','percent (porcentaje) o fixed (monto fijo).'],
      ['valor','DECIMAL(10,2)','NOT NULL','Porcentaje o monto del descuento.'],
      ['descripcion','VARCHAR(200)','NULL','Descripción legible del descuento.'],
      ['activo','TINYINT(1)','DEFAULT 1','0 = cupón desactivado (no eliminado).'],
    ],
    [1800, 1600, 2200, 3760]
  ),
  blank(),
  h2('9.7 Tabla: favoritos'),
  table(
    ['Campo','Tipo','Restricciones','Descripción'],
    [
      ['id','INT','PK, AUTO_INCREMENT','Identificador único.'],
      ['usuario_id','INT','FK usuarios(id) CASCADE, INDEX','Usuario que guardó el favorito.'],
      ['producto_id','INT','FK productos(id) CASCADE','Producto guardado.'],
      ['fecha','DATETIME','DEFAULT NOW()','Fecha en que se guardó.'],
      ['—','UNIQUE KEY','(usuario_id, producto_id)','Evita duplicados de favorito.'],
    ],
    [1800, 1600, 2200, 3760]
  ),
  blank(),
  h2('9.8 Tabla: configuracion'),
  p('Almacena pares clave-valor para la configuración del sitio (datos de contacto, redes sociales).'),
  table(
    ['Clave ejemplo','Descripción'],
    [
      ['contacto_telefono','Número de teléfono de la dulcería.'],
      ['contacto_email','Correo electrónico de contacto.'],
      ['contacto_direccion','Dirección física de la tienda.'],
      ['contacto_horario','Horario de atención.'],
      ['contacto_instagram','Usuario de Instagram.'],
      ['contacto_facebook','Página de Facebook.'],
      ['contacto_whatsapp','Número de WhatsApp.'],
    ],
    [3500, 5860]
  ),
  blank(),
  h2('9.9 Relaciones entre Tablas'),
  p('Las relaciones entre las tablas siguen el siguiente esquema:'),
  bullet('usuarios (1) ─ (N) pedidos: un usuario puede tener múltiples pedidos.'),
  bullet('pedidos (1) ─ (N) pedido_items: un pedido contiene uno o más productos.'),
  bullet('productos (1) ─ (N) pedido_items: un producto puede aparecer en múltiples pedidos.'),
  bullet('usuarios (1) ─ (N) favoritos: un usuario puede marcar múltiples favoritos.'),
  bullet('productos (1) ─ (N) favoritos: un producto puede ser favorito de múltiples usuarios.'),
  bullet('categorias (1) ─ (N) productos: una categoría agrupa múltiples productos.'),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 10. MÓDULOS
  // ═══════════════════════════════════════════════════════════
  h1('10. Módulos del Sistema'),

  h2('10.1 Módulo de Autenticación'),
  p('Gestiona el registro de nuevos usuarios, el inicio de sesión y la verificación de sesiones activas.'),
  pBold('Archivos involucrados:'),
  bullet('backend/routes/auth.js — Endpoints de registro, login y /me.'),
  bullet('backend/middleware/auth.js — Funciones authMiddleware y adminMiddleware.'),
  bullet('js/auth.js — Funciones de sesión en el cliente (isLoggedIn, isAdmin, getSession).'),
  bullet('login.html / registro.html — Formularios de interfaz.'),
  pBold('Flujo:'),
  numbered('El usuario completa el formulario de registro o login en el frontend.'),
  numbered('El frontend llama a POST /api/auth/registro o POST /api/auth/login.'),
  numbered('El backend valida los datos, verifica credenciales y genera un token JWT.'),
  numbered('El frontend guarda el token en localStorage o sessionStorage.'),
  numbered('En cada petición posterior, el token se envía en el header Authorization: Bearer {token}.'),
  numbered('El middleware verifica el token y extrae los datos del usuario (id, nombre, email, rol).'),
  blank(),

  h2('10.2 Módulo de Catálogo'),
  p('Muestra todos los productos disponibles con filtros dinámicos por categoría, precio y búsqueda de texto.'),
  pBold('Archivos involucrados:'),
  bullet('catalogo.html — Interfaz del catálogo con panel de filtros lateral.'),
  bullet('js/catalogo.js — Lógica de filtrado, renderizado de productos y botones de filtro.'),
  bullet('css/catalogo.css — Estilos del catálogo.'),
  bullet('backend/routes/productos.js — GET /api/productos con parámetros de filtro.'),
  pBold('Flujo:'),
  numbered('Al cargar la página, se solicitan las categorías al servidor para construir los botones de filtro dinámicamente.'),
  numbered('Se cargan todos los productos activos desde la API.'),
  numbered('El usuario puede filtrar por categoría (botones), precio máximo (rango deslizante) y texto (búsqueda).'),
  numbered('Los filtros se aplican en el cliente sin nueva petición al servidor.'),
  blank(),

  h2('10.3 Módulo de Carrito'),
  p('Permite al usuario agregar, quitar y modificar la cantidad de productos. El carrito se persiste en localStorage del navegador.'),
  pBold('Archivos involucrados:'),
  bullet('js/cart.js — Lógica del carrito (addToCart, removeFromCart, clearCart, getCart).'),
  bullet('carrito.html — Vista del carrito con resumen y botón de proceder al pago.'),
  blank(),

  h2('10.4 Módulo de Pedidos'),
  p('Gestiona el ciclo de vida completo de un pedido desde la confirmación hasta la entrega.'),
  pBold('Archivos involucrados:'),
  bullet('pago.html — Formulario de confirmación de pedido y aplicación de cupón.'),
  bullet('comprobante.html — Muestra el resumen del pedido confirmado.'),
  bullet('pedidos.html — Historial de pedidos del cliente.'),
  bullet('backend/routes/pedidos.js — Endpoints de creación, consulta y cambio de estado.'),
  blank(),

  h2('10.5 Módulo de Favoritos'),
  p('Permite al usuario marcar productos como favoritos para acceder rápidamente a ellos.'),
  pBold('Archivos involucrados:'),
  bullet('favoritos.html — Lista de productos favoritos del usuario.'),
  bullet('backend/routes/favoritos.js — Endpoints GET, POST y DELETE de favoritos.'),
  blank(),

  h2('10.6 Módulo de Cupones'),
  p('Permite aplicar códigos de descuento al carrito. Soporta descuentos porcentuales (20% de descuento) y de monto fijo ($50 de descuento).'),
  pBold('Archivos involucrados:'),
  bullet('backend/routes/cupones.js — Validación y gestión de cupones.'),
  blank(),

  h2('10.7 Panel de Administración'),
  p('Interfaz de control completa para el administrador del negocio. Acceso restringido mediante verificación de rol en el servidor.'),
  pBold('Archivos involucrados:'),
  bullet('admin.html — Interfaz del panel con secciones: Dashboard, Productos, Pedidos, Usuarios, Configuración.'),
  bullet('js/admin.js — Toda la lógica del panel (renderizado, formularios, llamadas a la API).'),
  pBold('Secciones del panel:'),
  bullet('Dashboard: estadísticas de ventas totales, pedidos por estado, usuarios registrados.'),
  bullet('Productos: tabla de productos con acciones de editar, eliminar y marcar destacado.'),
  bullet('Categorías: modal para gestionar categorías con emoji o imagen personalizada.'),
  bullet('Pedidos: lista de todos los pedidos con filtro por estado y cambio de estado en línea.'),
  bullet('Usuarios: lista de usuarios con opción de cambiar rol o eliminar.'),
  bullet('Cupones: gestión de códigos de descuento activos e inactivos.'),
  bullet('Configuración: formulario para actualizar datos de contacto y redes sociales.'),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 11. API REST
  // ═══════════════════════════════════════════════════════════
  h1('11. API REST — Endpoints'),
  p('Todos los endpoints de la API utilizan el prefijo /api/. El formato de datos es JSON. La autenticación se realiza mediante el header: Authorization: Bearer {token}.'),
  blank(),
  h2('11.1 Autenticación (/api/auth)'),
  table(
    ['Método','Endpoint','Acceso','Descripción'],
    [
      ['POST','/api/auth/registro','Público (5/hora)','Crear nueva cuenta de usuario.'],
      ['POST','/api/auth/login','Público (10/15min)','Iniciar sesión y obtener token JWT.'],
      ['GET','/api/auth/me','Token requerido','Verificar validez del token actual.'],
    ],
    [900, 2800, 2100, 3560]
  ),
  blank(),
  h2('11.2 Productos (/api/productos)'),
  table(
    ['Método','Endpoint','Acceso','Descripción'],
    [
      ['GET','/api/productos','Público','Listar productos. Filtros: ?categoria=, ?destacado=1, ?q=.'],
      ['GET','/api/productos/:id','Público','Obtener un producto por ID.'],
      ['POST','/api/productos','Admin','Crear producto nuevo.'],
      ['PUT','/api/productos/:id','Admin','Actualizar todos los datos del producto.'],
      ['DELETE','/api/productos/:id','Admin','Soft delete (activo = 0).'],
    ],
    [900, 2800, 1200, 4460]
  ),
  blank(),
  h2('11.3 Categorías, Pedidos, Favoritos, Cupones'),
  table(
    ['Método','Endpoint','Acceso','Descripción'],
    [
      ['GET','/api/categorias','Público','Listar todas las categorías.'],
      ['POST','/api/categorias','Admin','Crear categoría.'],
      ['PUT','/api/categorias/:id','Admin','Editar categoría (actualiza productos relacionados).'],
      ['DELETE','/api/categorias/:id','Admin','Eliminar si no tiene productos activos.'],
      ['POST','/api/pedidos/inconcluso','Login','Guardar pedido en progreso.'],
      ['PUT','/api/pedidos/:id/completar','Login','Confirmar pago del pedido.'],
      ['GET','/api/pedidos/mios','Login','Historial de pedidos del usuario.'],
      ['GET','/api/pedidos','Admin','Todos los pedidos con datos del cliente.'],
      ['PATCH','/api/pedidos/:id/estado','Admin','Cambiar estado del pedido.'],
      ['GET','/api/favoritos','Login','Favoritos del usuario logueado.'],
      ['POST','/api/favoritos/:productoId','Login','Agregar a favoritos.'],
      ['DELETE','/api/favoritos/:productoId','Login','Quitar de favoritos.'],
      ['POST','/api/cupones/validar','Login','Validar código y calcular descuento.'],
      ['GET','/api/cupones','Admin','Listar todos los cupones.'],
      ['POST','/api/cupones','Admin','Crear cupón nuevo.'],
      ['PATCH','/api/cupones/:id','Admin','Activar o desactivar cupón.'],
      ['POST','/api/upload/categoria','Admin','Subir imagen de categoría (multipart).'],
      ['POST','/api/upload/producto','Admin','Subir imagen de producto (multipart).'],
    ],
    [900, 2800, 1200, 4460]
  ),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 12. SEGURIDAD
  // ═══════════════════════════════════════════════════════════
  h1('12. Seguridad'),
  table(
    ['Mecanismo','Descripción','Implementación'],
    [
      ['Cifrado de contraseñas','Las contraseñas nunca se guardan en texto plano.','bcryptjs con cost factor 10 (~100ms por hash).'],
      ['Autenticación JWT','Tokens firmados con clave secreta y expiración de 7 días.','jsonwebtoken. El token se verifica en cada petición protegida.'],
      ['Control de acceso por roles','Dos roles: cliente y admin. El admin tiene acceso total a la API.','adminMiddleware verifica rol en el payload del token.'],
      ['Protección SQL Injection','Todas las consultas usan parámetros preparados (?).','mysql2 escapa automáticamente los valores.'],
      ['CORS configurado','Solo acepta peticiones del origen del frontend.','cors({ origin: process.env.FRONTEND_ORIGIN })'],
      ['Rate limiting','Límite de intentos en login (10/15min) y registro (5/hora).','express-rate-limit en los endpoints de autenticación.'],
      ['Validación de email','Verifica formato de correo en el registro.','Regex /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/ en el backend.'],
      ['Soft delete','Los productos eliminados no se borran físicamente.','Campo activo = 0. El historial de pedidos se preserva.'],
      ['Transacciones MySQL','La creación de pedidos es atómica.','BEGIN TRANSACTION / COMMIT / ROLLBACK en pedidos.'],
      ['Protección de último admin','El sistema impide eliminar el único administrador.','Verificación de conteo de admins antes del DELETE.'],
      ['Variables de entorno','Credenciales fuera del código fuente.','Archivo .env excluido del repositorio con .gitignore.'],
    ],
    [2200, 3500, 3660]
  ),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 13. MANUAL TÉCNICO
  // ═══════════════════════════════════════════════════════════
  h1('13. Manual Técnico de Instalación'),
  h2('Requisitos previos'),
  bullet('Node.js versión 18 o superior (https://nodejs.org).'),
  bullet('MySQL 8.x instalado y en ejecución.'),
  bullet('Cliente MySQL (MySQL Workbench o línea de comandos).'),
  bullet('Navegador web moderno (Chrome, Firefox, Edge o Safari).'),
  blank(),
  h2('Paso 1 — Configurar la base de datos'),
  numbered('Abrir MySQL Workbench o la terminal de MySQL.'),
  numbered('Ejecutar el archivo dulceria_charles.sql completo para crear la base de datos, tablas e insertar los datos iniciales.'),
  numbered('Verificar que la base de datos dulceria_charles fue creada correctamente con sus 8 tablas.'),
  blank(),
  h2('Paso 2 — Configurar las variables de entorno'),
  numbered('En la carpeta backend/, copiar el archivo .env.example y renombrarlo como .env.'),
  numbered('Editar el archivo .env con los datos de conexión de MySQL:'),
  new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: 720 },
    children: [new TextRun({ text: 'DB_HOST=localhost', font: 'Courier New', size: 18, color: DGRAY })]
  }),
  new Paragraph({
    spacing: { after: 80 },
    indent: { left: 720 },
    children: [new TextRun({ text: 'DB_USER=root', font: 'Courier New', size: 18, color: DGRAY })]
  }),
  new Paragraph({
    spacing: { after: 80 },
    indent: { left: 720 },
    children: [new TextRun({ text: 'DB_PASSWORD=tu_contraseña', font: 'Courier New', size: 18, color: DGRAY })]
  }),
  new Paragraph({
    spacing: { after: 80 },
    indent: { left: 720 },
    children: [new TextRun({ text: 'DB_NAME=dulceria_charles', font: 'Courier New', size: 18, color: DGRAY })]
  }),
  new Paragraph({
    spacing: { after: 80 },
    indent: { left: 720 },
    children: [new TextRun({ text: 'JWT_SECRET=clave_secreta_larga_y_aleatoria', font: 'Courier New', size: 18, color: DGRAY })]
  }),
  new Paragraph({
    spacing: { after: 160 },
    indent: { left: 720 },
    children: [new TextRun({ text: 'PORT=3000', font: 'Courier New', size: 18, color: DGRAY })]
  }),
  blank(),
  h2('Paso 3 — Instalar dependencias del backend'),
  numbered('Abrir una terminal en la carpeta backend/.'),
  numbered('Ejecutar: npm install'),
  numbered('Esperar a que se instalen todas las dependencias listadas en package.json.'),
  blank(),
  h2('Paso 4 — Iniciar el servidor'),
  p('Para desarrollo (con recarga automática):'),
  new Paragraph({
    spacing: { before: 80, after: 160 },
    indent: { left: 720 },
    children: [new TextRun({ text: 'npm run dev', font: 'Courier New', size: 20, bold: true, color: PINK })]
  }),
  p('Para producción:'),
  new Paragraph({
    spacing: { before: 80, after: 160 },
    indent: { left: 720 },
    children: [new TextRun({ text: 'npm start', font: 'Courier New', size: 20, bold: true, color: PINK })]
  }),
  blank(),
  h2('Paso 5 — Acceder al sistema'),
  table(
    ['URL','Descripción'],
    [
      ['http://localhost:3000','Página principal del sitio (frontend).'],
      ['http://localhost:3000/admin.html','Panel de administración.'],
      ['http://localhost:3000/api/productos','Verificar que la API responde correctamente.'],
    ],
    [3500, 5860]
  ),
  blank(),
  h2('Credenciales iniciales del administrador'),
  table(
    ['Campo','Valor'],
    [
      ['Correo electrónico','admin@dulceriacharles.com'],
      ['Contraseña','admin123'],
      ['Nota','Cambiar la contraseña inmediatamente después de la primera sesión.'],
    ],
    [2500, 6860]
  ),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 14. MANUAL DE USUARIO
  // ═══════════════════════════════════════════════════════════
  h1('14. Manual de Usuario'),
  h2('14.1 Registro de cuenta nueva'),
  numbered('Acceder a la página principal del sitio.'),
  numbered('Hacer clic en el botón "Iniciar sesión / Registrarse" en la barra superior.'),
  numbered('Seleccionar la pestaña "Registrarse".'),
  numbered('Completar el formulario con nombre completo, correo electrónico y contraseña (mínimo 6 caracteres).'),
  numbered('Hacer clic en "Crear cuenta".'),
  numbered('El sistema iniciará sesión automáticamente tras el registro exitoso.'),
  blank(),
  h2('14.2 Inicio de sesión'),
  numbered('Acceder a la página de login.'),
  numbered('Ingresar el correo electrónico y contraseña registrados.'),
  numbered('Hacer clic en "Iniciar sesión".'),
  numbered('Opcionalmente marcar "Recuérdame" para mantener la sesión al cerrar el navegador.'),
  blank(),
  h2('14.3 Explorar el catálogo'),
  numbered('Acceder a la sección "Catálogo" desde el menú principal.'),
  numbered('Usar los botones de categoría en el panel izquierdo para filtrar por tipo de producto.'),
  numbered('Usar el control deslizante de precio para establecer el precio máximo.'),
  numbered('Usar la barra de búsqueda para encontrar productos por nombre.'),
  numbered('Hacer clic en "Agregar al carrito" en cualquier producto de interés.'),
  blank(),
  h2('14.4 Proceso de compra'),
  numbered('Revisar el carrito haciendo clic en el ícono del carrito en la barra superior.'),
  numbered('Ajustar las cantidades o eliminar productos según sea necesario.'),
  numbered('Hacer clic en "Proceder al pago".'),
  numbered('Iniciar sesión si aún no se ha hecho.'),
  numbered('En la pantalla de pago, ingresar nombre completo y número de teléfono.'),
  numbered('Si se tiene un cupón de descuento, ingresarlo y hacer clic en "Aplicar".'),
  numbered('Seleccionar el método de pago (efectivo, tarjeta o transferencia).'),
  numbered('Revisar el resumen del pedido y hacer clic en "Confirmar pedido".'),
  numbered('El sistema mostrará el comprobante con el número de pedido.'),
  numbered('Acudir a la tienda con el número de pedido para recoger el producto.'),
  blank(),
  h2('14.5 Consultar mis pedidos'),
  numbered('Iniciar sesión con la cuenta de usuario.'),
  numbered('Acceder a "Mis pedidos" desde el menú de usuario.'),
  numbered('Ver la lista de todos los pedidos realizados con su estado actual.'),
  numbered('Hacer clic en un pedido para ver el detalle completo.'),
  blank(),
  h2('14.6 Gestión de favoritos'),
  numbered('En cualquier producto del catálogo, hacer clic en el ícono de corazón.'),
  numbered('Para ver los favoritos guardados, acceder a la sección "Favoritos" del menú.'),
  numbered('Para quitar un producto de favoritos, hacer clic nuevamente en el corazón.'),
  blank(),
  h2('14.7 Panel de administración — Gestión de productos'),
  numbered('Iniciar sesión con una cuenta de administrador.'),
  numbered('Acceder a admin.html o desde el menú "Panel Admin".'),
  numbered('En la sección "Productos", hacer clic en "+ Agregar producto".'),
  numbered('Completar el formulario con nombre, categoría, precio y opcionalmente imagen y proveedor.'),
  numbered('Para editar un producto, hacer clic en el botón "Editar" de la fila correspondiente.'),
  numbered('Para eliminar, hacer clic en "Eliminar" y confirmar la acción.'),
  blank(),
  h2('14.8 Panel de administración — Gestión de pedidos'),
  numbered('En la sección "Pedidos" del panel, ver la lista de todos los pedidos.'),
  numbered('Usar el filtro de estado para ver solo los pedidos pendientes de entregar.'),
  numbered('Cuando el cliente recoja su pedido, cambiar el estado a "Entregado" desde el selector.'),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 15. DIAGRAMAS
  // ═══════════════════════════════════════════════════════════
  h1('15. Diagramas del Sistema'),
  h2('15.1 Diagrama de Casos de Uso'),
  p('Actores del sistema:'),
  bullet('Visitante: usuario sin sesión iniciada.'),
  bullet('Cliente: usuario registrado con sesión activa.'),
  bullet('Administrador: usuario con rol admin.'),
  blank(),
  p('Casos de uso del Visitante:'),
  bullet('CU-01: Ver catálogo de productos.'),
  bullet('CU-02: Filtrar productos por categoría, precio y nombre.'),
  bullet('CU-03: Ver información de contacto.'),
  bullet('CU-04: Registrar cuenta nueva.'),
  bullet('CU-05: Iniciar sesión.'),
  blank(),
  p('Casos de uso del Cliente (hereda del Visitante):'),
  bullet('CU-06: Agregar/quitar productos del carrito.'),
  bullet('CU-07: Aplicar cupón de descuento.'),
  bullet('CU-08: Confirmar pedido.'),
  bullet('CU-09: Ver historial de pedidos.'),
  bullet('CU-10: Gestionar favoritos.'),
  blank(),
  p('Casos de uso del Administrador (hereda del Cliente):'),
  bullet('CU-11: Gestionar productos (CRUD).'),
  bullet('CU-12: Gestionar categorías.'),
  bullet('CU-13: Ver y actualizar estado de pedidos.'),
  bullet('CU-14: Gestionar usuarios.'),
  bullet('CU-15: Gestionar cupones.'),
  bullet('CU-16: Configurar datos del sitio.'),
  bullet('CU-17: Ver dashboard estadístico.'),
  blank(),
  h2('15.2 Diagrama Entidad-Relación (descripción)'),
  p('Las entidades principales y sus relaciones son:'),
  bullet('USUARIO (1) ──< PEDIDO: Un usuario realiza muchos pedidos.'),
  bullet('PEDIDO (1) ──< PEDIDO_ITEM: Un pedido contiene uno o más items.'),
  bullet('PRODUCTO (1) ──< PEDIDO_ITEM: Un producto aparece en muchos pedidos.'),
  bullet('USUARIO (1) ──< FAVORITO: Un usuario tiene muchos favoritos.'),
  bullet('PRODUCTO (1) ──< FAVORITO: Un producto puede ser favorito de muchos usuarios.'),
  bullet('CATEGORIA (1) ──< PRODUCTO: Una categoría agrupa muchos productos.'),
  blank(),
  h2('15.3 Diagrama de Secuencia — Proceso de Compra'),
  p('Secuencia del flujo de compra entre componentes:'),
  table(
    ['Paso','Componente','Acción'],
    [
      ['1','Cliente → Catálogo','Explora y agrega producto al carrito (localStorage).'],
      ['2','Cliente → Login','Inicia sesión. Backend genera token JWT.'],
      ['3','Frontend → Backend','POST /api/pedidos/inconcluso con items del carrito.'],
      ['4','Backend → MySQL','INSERT INTO pedidos (estado=pendiente_finalizar).'],
      ['5','Backend → MySQL','INSERT INTO pedido_items para cada producto.'],
      ['6','Frontend → Backend','PUT /api/pedidos/:id/completar con datos del cliente.'],
      ['7','Backend → MySQL','UPDATE pedidos SET estado=pendiente_entregar.'],
      ['8','Frontend','Muestra comprobante con número de pedido.'],
      ['9','Admin → Backend','PATCH /api/pedidos/:id/estado (entregado).'],
      ['10','Backend → MySQL','UPDATE pedidos SET estado=entregado.'],
    ],
    [600, 2200, 6560]
  ),
  blank(),
  h2('15.4 Diagrama de Actividades — Registro de Usuario'),
  p('Flujo de actividades para el registro de una cuenta nueva:'),
  numbered('Usuario accede al formulario de registro.'),
  numbered('Sistema valida que todos los campos estén completos.'),
  numbered('Sistema valida formato de email con expresión regular.'),
  numbered('Sistema valida que la contraseña tenga al menos 6 caracteres.'),
  numbered('Sistema verifica que el email no esté registrado previamente.'),
  numbered('Sistema genera hash bcrypt de la contraseña.'),
  numbered('Sistema inserta el nuevo usuario en la base de datos.'),
  numbered('Sistema genera token JWT con los datos del usuario.'),
  numbered('Sistema devuelve el token al cliente.'),
  numbered('Cliente guarda el token y accede como usuario autenticado.'),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 16. PRUEBAS
  // ═══════════════════════════════════════════════════════════
  h1('16. Pruebas Realizadas'),
  table(
    ['ID','Caso de Prueba','Entrada','Resultado Esperado','Resultado Obtenido','Estado'],
    [
      ['PT-01','Registro con datos válidos','Nombre, email, contraseña válidos.','Cuenta creada y token devuelto.','Token generado, sesión iniciada.','✅ Exitoso'],
      ['PT-02','Registro con email duplicado','Email ya registrado.','Error 409: "Ya existe una cuenta".','Error 409 recibido correctamente.','✅ Exitoso'],
      ['PT-03','Registro con email inválido','email = "noesuncorreo"','Error 400: formato inválido.','Validación de regex rechaza.','✅ Exitoso'],
      ['PT-04','Login con credenciales correctas','Email y contraseña válidos.','Token JWT devuelto.','Token correcto recibido.','✅ Exitoso'],
      ['PT-05','Login con contraseña incorrecta','Contraseña errónea.','Error 401: credenciales incorrectas.','Error genérico sin revelar cuál campo falló.','✅ Exitoso'],
      ['PT-06','Rate limiting en login','11 intentos en 15 minutos.','Bloqueo en el intento 11.','Respuesta 429 Too Many Requests.','✅ Exitoso'],
      ['PT-07','Filtro de catálogo por categoría','?categoria=chocolates','Solo productos de chocolates.','Lista filtrada correctamente.','✅ Exitoso'],
      ['PT-08','Búsqueda por texto','?q=paleta','Productos con "paleta" en el nombre.','Resultados correctos con LIKE.','✅ Exitoso'],
      ['PT-09','Crear pedido con carrito válido','Items, subtotal, total.','Pedido creado en BD.','ID de pedido devuelto.','✅ Exitoso'],
      ['PT-10','Crear pedido con carrito vacío','items = []','Error 400: carrito vacío.','Error recibido correctamente.','✅ Exitoso'],
      ['PT-11','Validar cupón activo','Código "BIENVENIDO"','Descuento de $30.','Descuento calculado correctamente.','✅ Exitoso'],
      ['PT-12','Validar cupón inactivo','Código desactivado.','Error 404: código no válido.','Error recibido correctamente.','✅ Exitoso'],
      ['PT-13','Acceso a admin sin token','Sin header Authorization.','Error 401: no autorizado.','Acceso denegado correctamente.','✅ Exitoso'],
      ['PT-14','Acceso a admin con rol cliente','Token de usuario normal.','Error 403: acceso restringido.','Error 403 recibido.','✅ Exitoso'],
      ['PT-15','Subida de imagen de categoría','Archivo PNG menor a 5MB.','URL de imagen devuelta.','Imagen guardada y URL correcta.','✅ Exitoso'],
      ['PT-16','Eliminar categoría con productos','Categoría con productos activos.','Error 409: hay productos activos.','Protección funcionando.','✅ Exitoso'],
      ['PT-17','Agregar favorito duplicado','Mismo usuario y producto.','Sin error, INSERT IGNORE.','No se crea duplicado.','✅ Exitoso'],
    ],
    [700, 2400, 1800, 1800, 1800, 860]
  ),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 17. PROBLEMAS Y SOLUCIONES
  // ═══════════════════════════════════════════════════════════
  h1('17. Problemas Encontrados y Soluciones'),
  table(
    ['Problema','Causa','Solución Aplicada'],
    [
      ['Categorías creadas desde el admin no podían asignarse a productos.','La columna "categoria" en productos era un ENUM fijo con valores hardcodeados.','Se modificó la columna a VARCHAR(100), permitiendo cualquier valor de la tabla categorias.'],
      ['Los pedidos no se insertaban correctamente en la base de datos.','Los estados del ENUM en la BD (pendiente, confirmado...) no coincidían con los usados por el backend (pendiente_finalizar, pendiente_entregar...).','Se redefinió el ENUM en la BD para que coincida exactamente con los estados del código.'],
      ['Las consultas de pedidos eran muy lentas con muchos registros.','Por cada pedido se hacía una consulta adicional para obtener sus items (problema N+1).','Se reemplazó el bucle de consultas por un único JOIN con una función de agrupación en memoria.'],
      ['Cualquier sitio web externo podía hacer peticiones a la API.','CORS estaba configurado como app.use(cors()) sin restricción de origen.','Se configuró cors({ origin: process.env.FRONTEND_ORIGIN }) para aceptar solo el origen correcto.'],
      ['La contraseña del admin por defecto era insegura.','El hash inicial era el hash de ejemplo de la documentación de Laravel, conocido públicamente.','Se generó un nuevo hash con bcrypt para la contraseña "Charles2026!" y se actualizó en el SQL.'],
      ['Scripts de migración sueltos en la raíz del backend generaban confusión.','Al resolver problemas durante el desarrollo se crearon scripts JS que se quedaron en la raíz.','Se creó la carpeta migrations/ y se movieron todos los scripts ahí para mantener la estructura limpia.'],
      ['Las imágenes subidas para categorías se veían pequeñas en comparación con los emojis.','La función renderCatIcon asignaba el mismo tamaño a emojis e imágenes, pero los emojis visualmente ocupan más espacio.','Se envolvió la imagen en el mismo span contenedor que el emoji (cat-icon--img) con dimensiones relativas al font-size.'],
    ],
    [2200, 2600, 4560]
  ),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 18. CONCLUSIONES
  // ═══════════════════════════════════════════════════════════
  h1('18. Conclusiones'),
  p('El desarrollo del Sistema Web de Dulcería Charles permitió integrar de manera práctica los conocimientos adquiridos en las áreas de desarrollo web, bases de datos relacionales, seguridad informática y arquitectura de software.'),
  p('Se logró construir una plataforma de comercio electrónico funcional, segura y escalable que resuelve una necesidad real de un negocio local: la gestión digital de su catálogo de productos y el procesamiento de pedidos en línea bajo el modelo pickup.'),
  p('Desde el punto de vista técnico, el proyecto demuestra la viabilidad de desarrollar aplicaciones web completas utilizando tecnologías de código abierto (Node.js, Express, MySQL) sin dependencia de frameworks costosos o propietarios. La arquitectura REST stateless facilita la escalabilidad futura del sistema.'),
  p('Las medidas de seguridad implementadas (bcrypt, JWT, rate limiting, consultas parametrizadas, control de acceso por roles) garantizan que el sistema sea apto para manejar datos sensibles de usuarios en un entorno de producción.'),
  p('La experiencia de identificar y resolver problemas reales durante el desarrollo (inconsistencias en la base de datos, problemas de rendimiento N+1, vulnerabilidades de seguridad) fue de gran valor formativo, pues reproduce fielmente el proceso de desarrollo profesional de software.'),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 19. RECOMENDACIONES
  // ═══════════════════════════════════════════════════════════
  h1('19. Recomendaciones'),
  h2('Mejoras a corto plazo'),
  numbered('Implementar una pasarela de pago real (Stripe, PayPal o MercadoPago) para procesar pagos en línea.'),
  numbered('Agregar notificaciones por correo electrónico al confirmar pedidos y al cambiar su estado.'),
  numbered('Implementar un sistema de reseñas y calificaciones de productos para mejorar la confianza del cliente.'),
  numbered('Agregar paginación del lado del servidor para el catálogo cuando el número de productos sea grande.'),
  blank(),
  h2('Mejoras a mediano plazo'),
  numbered('Desarrollar control de inventario con stock por producto y alertas de bajo inventario.'),
  numbered('Implementar un módulo de reportes y estadísticas avanzadas (ventas por período, productos más vendidos, ingresos por categoría).'),
  numbered('Migrar el frontend a un framework como Vue.js o React para mejor mantenibilidad y experiencia de usuario.'),
  numbered('Implementar modo oscuro y mejoras de accesibilidad (WCAG 2.1).'),
  blank(),
  h2('Mejoras a largo plazo'),
  numbered('Habilitar la opción de entrega a domicilio con cálculo de zona de cobertura.'),
  numbered('Desarrollar una aplicación móvil nativa (iOS/Android) utilizando la misma API REST.'),
  numbered('Migrar la infraestructura a servicios en la nube (AWS, GCP, Azure) para mayor disponibilidad.'),
  numbered('Implementar un sistema de autenticación OAuth2 para registro con Google o Facebook.'),
  pb(),

  // ═══════════════════════════════════════════════════════════
  // 20. ANEXOS
  // ═══════════════════════════════════════════════════════════
  h1('20. Anexos'),
  h2('Anexo A — Dependencias del Proyecto'),
  table(
    ['Paquete','Versión','Tipo','Función'],
    [
      ['express','4.x','Producción','Framework HTTP para Node.js.'],
      ['mysql2','3.x','Producción','Driver MySQL con soporte async/await.'],
      ['bcryptjs','2.4.x','Producción','Cifrado de contraseñas.'],
      ['jsonwebtoken','9.x','Producción','Generación y verificación de JWT.'],
      ['multer','2.x','Producción','Subida de archivos multipart.'],
      ['dotenv','16.x','Producción','Carga de variables de entorno.'],
      ['cors','2.x','Producción','Control de CORS.'],
      ['express-rate-limit','—','Producción','Rate limiting por IP.'],
      ['nodemon','3.x','Desarrollo','Reinicio automático en desarrollo.'],
    ],
    [2200, 1200, 1400, 4560]
  ),
  blank(),
  h2('Anexo B — Variables de Entorno'),
  table(
    ['Variable','Descripción','Valor por defecto'],
    [
      ['DB_HOST','Servidor de MySQL.','localhost'],
      ['DB_PORT','Puerto de MySQL.','3306'],
      ['DB_USER','Usuario de MySQL.','root'],
      ['DB_PASSWORD','Contraseña de MySQL.','(vacío)'],
      ['DB_NAME','Nombre de la base de datos.','dulceria_charles'],
      ['JWT_SECRET','Clave para firmar tokens JWT.','(sin valor por defecto — obligatorio)'],
      ['PORT','Puerto del servidor Node.js.','3000'],
      ['FRONTEND_ORIGIN','Origen permitido por CORS.','http://localhost:3000'],
    ],
    [2500, 3500, 3360]
  ),
  blank(),
  h2('Anexo C — Cupones Iniciales del Sistema'),
  table(
    ['Código','Tipo','Valor','Descripción'],
    [
      ['CHOCO20','Porcentaje','20%','20% de descuento en chocolates.'],
      ['BIENVENIDO','Monto fijo','$30','$30 de descuento de bienvenida.'],
      ['CHARLES10','Porcentaje','10%','10% de descuento general.'],
      ['NAVIDAD25','Porcentaje','25%','25% de descuento navideño.'],
      ['PRIMERACOMPRA','Porcentaje','15%','15% para la primera compra.'],
      ['SWEET50','Monto fijo','$50','$50 de descuento.'],
      ['CHARLES100','Monto fijo','$100','$100 de descuento.'],
    ],
    [2300, 1800, 1400, 3860]
  ),
  blank(),
  h2('Anexo D — Estados del Pedido'),
  table(
    ['Estado','Significado','Quién lo asigna'],
    [
      ['pendiente_finalizar','El cliente entró a la pantalla de pago pero no confirmó.','Sistema automáticamente al entrar a pago.html.'],
      ['pendiente_entregar','Pago confirmado. El pedido está listo para ser recogido.','Sistema al confirmar el pedido.'],
      ['entregado','El cliente recogió su pedido en la tienda.','Administrador desde el panel.'],
      ['cancelado','El pedido fue cancelado.','Administrador desde el panel.'],
    ],
    [2500, 3500, 3360]
  ),
  blank(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: PINK } },
    children: [new TextRun({ text: '— Fin de la documentación — Dulcería Charles v1.0 — Junio 2026 —', size: 20, color: DGRAY, font: 'Arial', italics: true })]
  })
);

// ── DOCUMENTO ────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: 'numbers',
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: PINK },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: DGRAY },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: DGRAY },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: PINK } },
          spacing: { after: 120 },
          children: [new TextRun({ text: 'Dulceria Charles — Documentacion Tecnica', size: 18, color: DGRAY, font: 'Arial', italics: true })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
          spacing: { before: 120 },
          children: [
            new TextRun({ text: 'Pagina ', size: 18, color: DGRAY, font: 'Arial' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: DGRAY, font: 'Arial' }),
            new TextRun({ text: ' de ', size: 18, color: DGRAY, font: 'Arial' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: DGRAY, font: 'Arial' }),
          ]
        })]
      })
    },
    children: sections_children
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const out = 'C:/Users/gera_/Desktop/Documentacion_Dulceria_Charles.docx';
  fs.writeFileSync(out, buffer);
  console.log('OK: ' + out);
}).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
