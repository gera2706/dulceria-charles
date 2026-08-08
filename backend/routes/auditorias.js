/* ================================================================
   ARCHIVO: backend/routes/auditorias.js
   PROPÓSITO: Panel admin → sección "Auditorías". Sirve los reportes
   HTML de docs/auditorias/ SOLO a administradores logueados.

   ¿POR QUÉ NO SIRVEN ESTOS ARCHIVOS DESDE public/ COMO EL RESTO DEL
   SITIO? Porque public/ se sirve sin ningún login (express.static en
   server.js) — cualquiera con el link podría leerlos, y algunos
   reportes documentan hallazgos de seguridad. Estas rutas exigen
   adminMiddleware (mismo login que el resto del panel admin), igual
   que /api/pedidos o /api/usuarios.

   docs/ está en .gitignore a propósito (ver deploy-infra-cpanel): no
   se sube con git push/"Update from Remote". Para que esta sección
   funcione en producción, los archivos de docs/auditorias/ hay que
   subirlos UNA VEZ al servidor por fuera de git (cPanel → Administrador
   de archivos → subir la carpeta docs/auditorias/ tal cual, dentro de
   la raíz del repo en el servidor). Cada auditoría nueva que se
   agregue localmente hay que volver a subirla ahí a mano.
================================================================ */

const router = require('express').Router();
const fs     = require('fs');
const path   = require('path');
const { adminMiddleware } = require('../middleware/auth');

// backend/routes/auditorias.js → sube dos niveles (routes/ y backend/)
// para llegar a la raíz del repo, y de ahí a docs/auditorias/.
const DIR_AUDITORIAS = path.join(__dirname, '..', '..', 'docs', 'auditorias');

// Solo nombres de archivo "planos" (sin / ni ..) terminados en .html —
// evita que alguien pida ../../.env o algo fuera de la carpeta.
const NOMBRE_VALIDO = /^[a-zA-Z0-9._-]+\.html$/;

/* ----------------------------------------------------------------
   GET /api/auditorias
   Lista los reportes disponibles (nombre + tamaño + fecha de
   modificación), más recientes primero. Si la carpeta no existe
   todavía (nunca se subió nada al servidor), devuelve una lista
   vacía en vez de un error — es un estado normal, no una falla.
---------------------------------------------------------------- */
router.get('/', adminMiddleware, async (req, res) => {
  try {
    if (!fs.existsSync(DIR_AUDITORIAS)) return res.json([]);

    const archivos = fs.readdirSync(DIR_AUDITORIAS)
      .filter(function (f) { return NOMBRE_VALIDO.test(f); })
      .map(function (f) {
        const stat = fs.statSync(path.join(DIR_AUDITORIAS, f));
        return { nombre: f, tamano: stat.size, fecha: stat.mtime };
      })
      .sort(function (a, b) { return b.fecha - a.fecha; });

    res.json(archivos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar las auditorías.' });
  }
});

/* ----------------------------------------------------------------
   GET /api/auditorias/:nombre
   Devuelve el HTML crudo de un reporte. El frontend lo pide con
   fetch() (mandando el token en el header) y lo abre en una pestaña
   nueva con un blob: URL — un <a href> normal no podría mandar el
   header de autorización. Ver public/js/admin.js → abrirAuditoria().
---------------------------------------------------------------- */
router.get('/:nombre', adminMiddleware, async (req, res) => {
  try {
    const nombre = req.params.nombre;
    if (!NOMBRE_VALIDO.test(nombre)) return res.status(400).json({ error: 'Nombre de archivo inválido.' });

    const ruta = path.join(DIR_AUDITORIAS, nombre);

    // Defensa extra: confirma que la ruta final sigue DENTRO de
    // DIR_AUDITORIAS (por si en el futuro NOMBRE_VALIDO se afloja).
    if (!ruta.startsWith(DIR_AUDITORIAS + path.sep)) return res.status(400).json({ error: 'Ruta inválida.' });

    if (!fs.existsSync(ruta)) return res.status(404).json({ error: 'Auditoría no encontrada.' });

    const html = fs.readFileSync(ruta, 'utf8');
    // res.type('html') deja el header como "text/html" SIN charset —
    // el navegador tiene que adivinar la codificación, y a veces adivina
    // mal (los acentos salen como "Ã³" etc.). Declarar utf-8 explícito
    // evita esa adivinanza.
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer la auditoría.' });
  }
});

module.exports = router;
