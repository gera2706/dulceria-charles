/* ================================================================
   ROUTES/UPLOAD.JS — Dulcería Charles
   Maneja la subida de imágenes al servidor.
   Las imágenes se guardan en la carpeta img/ del frontend
   y se devuelve la ruta relativa para guardarla en la BD.
   Solo administradores pueden subir imágenes.
================================================================ */

const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { adminMiddleware } = require('../middleware/auth');

/* ── Configuración de multer ──
   Define dónde guardar los archivos y cómo nombrarlos.
   El nombre final es: timestamp + nombre_original_sin_espacios
   Ejemplo: 1717430000000-refrescos.jpg
   Las imágenes viven en public/img/ (el frontend se movió ahí, ver
   server.js), por eso la ruta baja dos niveles y entra a public/. */
function crearStorage(carpeta) {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      var dir = path.join(__dirname, '..', '..', 'public', 'img', carpeta);
      /* Crear la carpeta si no existe */
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      var ext      = path.extname(file.originalname).toLowerCase();
      var baseName = path.basename(file.originalname, ext)
                        .replace(/\s+/g, '-')   // espacios → guiones
                        .replace(/[^a-zA-Z0-9-_]/g, '') // quitar caracteres especiales
                        .toLowerCase();
      cb(null, Date.now() + '-' + baseName + ext);
    }
  });
}

/* Solo acepta imágenes RASTER. SVG se excluye a propósito: un SVG
   puede llevar <script> embebido y ejecutarse si alguien lo abre
   directo desde img/ — es un vector de XSS almacenado. mimetype y
   extensión los manda el cliente (falsificables), pero al menos
   ya no se acepta el tipo de archivo más riesgoso. */
function filtroImagenes(req, file, cb) {
  var tipos = /jpeg|jpg|png|gif|webp|avif/;
  if (tipos.test(file.mimetype) && tipos.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif, avif).'));
  }
}

var uploadCategorias = multer({
  storage: crearStorage('categorias'),
  fileFilter: filtroImagenes,
  limits: { fileSize: 5 * 1024 * 1024 } // máximo 5 MB
});

var uploadProductos = multer({
  storage: crearStorage('productos_upload'),
  fileFilter: filtroImagenes,
  limits: { fileSize: 5 * 1024 * 1024 }
});

/* ----------------------------------------------------------------
   POST /api/upload/categoria
   Sube una imagen para una categoría.
   Devuelve la ruta relativa para usar en el campo "icono".
   Ejemplo de respuesta: { url: "img/categorias/1717430000000-refrescos.jpg" }
---------------------------------------------------------------- */
router.post('/categoria', adminMiddleware, uploadCategorias.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
  var url = 'img/categorias/' + req.file.filename;
  res.json({ ok: true, url });
});

/* ----------------------------------------------------------------
   POST /api/upload/producto
   Sube una imagen para un producto.
   Devuelve la ruta relativa para usar en el campo "imagen".
---------------------------------------------------------------- */
router.post('/producto', adminMiddleware, uploadProductos.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
  var url = 'img/productos_upload/' + req.file.filename;
  res.json({ ok: true, url });
});

module.exports = router;
