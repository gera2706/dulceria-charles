/* ================================================================
   ARCHIVO: backend/routes/productos.js
   PROPÓSITO: Manejar todas las operaciones del catálogo de productos.

   ¿QUÉ ES UN CRUD?
   CRUD = Create, Read, Update, Delete (Crear, Leer, Actualizar, Borrar)
   Es el conjunto básico de operaciones que se hacen sobre cualquier
   dato en un sistema. Aquí implementamos CRUD completo para productos.

   MÉTODOS HTTP Y SU SIGNIFICADO:
   GET    → Leer/obtener información (no modifica nada)
   POST   → Crear algo nuevo
   PUT    → Reemplazar/actualizar un registro completo
   DELETE → Eliminar un registro

   PERMISOS:
   - Leer productos: PÚBLICO (cualquiera puede ver el catálogo)
   - Crear/editar/eliminar: solo ADMIN (protegido con adminMiddleware)
================================================================ */

const router = require('express').Router();
const db     = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

/* ----------------------------------------------------------------
   RUTA: GET /api/productos
   PROPÓSITO: Devolver la lista de productos activos del catálogo.
   ACCESO: Público
   FILTROS OPCIONALES (van en la URL como parámetros):
     ?categoria=bombones  → solo productos de esa categoría
     ?destacado=1         → solo productos marcados como destacados
     ?q=paleta            → busca productos cuyo nombre contenga "paleta"
   Ejemplo de URL combinada: /api/productos?categoria=gomitas&q=ositos
---------------------------------------------------------------- */
router.get('/', async (req, res) => {
  try {
    // Construimos la consulta SQL dinámicamente según los filtros recibidos.
    // Empezamos con la base: solo productos activos (activo=1 significa
    // que no han sido "eliminados". Ver el DELETE más abajo para entender.)
    let sql    = 'SELECT id, nombre, categoria, precio, imagen, destacado, proveedor, stock, stock_minimo, fecha_creacion FROM productos WHERE activo = 1';
    const vals = [];
    // vals guarda los valores que reemplazarán los ? en la consulta.
    // Esto es CRUCIAL para seguridad: nunca concatenamos strings directamente
    // porque eso abre la puerta a SQL Injection.

    // Si viene el filtro de categoría, agregamos una condición AND
    if (req.query.categoria) {
      sql += ' AND categoria = ?';
      vals.push(req.query.categoria);
      // req.query contiene los parámetros de la URL (lo que va después del ?)
    }

    // Si viene el filtro de destacados, solo traemos los marcados con ⭐
    if (req.query.destacado === '1') {
      sql += ' AND destacado = 1';
      // No necesita ? porque no es un valor del usuario, es fijo.
    }

    // Si viene una búsqueda por texto, usamos LIKE con % como comodín
    if (req.query.q) {
      sql += ' AND nombre LIKE ?';
      vals.push('%' + req.query.q + '%');
      // LIKE '%paleta%' en SQL significa: "contiene la palabra paleta en cualquier posición"
      // El % antes significa "cualquier texto antes" y el % después "cualquier texto después"
    }

    sql += ' ORDER BY id ASC';
    // Ordenamos por ID para que siempre salgan en el mismo orden.

    const [rows] = await db.query(sql, vals);
    // db.query devuelve un array: [filas, metadata].
    // Con [rows] solo nos quedamos con las filas (destructuring).

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos.' });
  }
});

/* ----------------------------------------------------------------
   RUTA: GET /api/productos/:id
   PROPÓSITO: Devolver UN solo producto por su ID.
   ACCESO: Público
   PARÁMETRO: :id en la URL → por ejemplo /api/productos/5
---------------------------------------------------------------- */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM productos WHERE id = ? AND activo = 1', [req.params.id]
    );
    // req.params.id extrae el :id de la URL
    // AND activo = 1 asegura que no mostremos productos eliminados

    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado.' });
    // 404 = "No encontrado". Si el array está vacío, el producto no existe.

    res.json(rows[0]);
    // rows[0] porque la consulta por ID siempre devuelve 0 o 1 resultado.
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

/* ----------------------------------------------------------------
   RUTA: POST /api/productos
   PROPÓSITO: Agregar un producto nuevo al catálogo.
   ACCESO: Solo administradores (adminMiddleware lo garantiza)
   RECIBE: { nombre, categoria, precio, imagen, destacado, proveedor, stock, stock_minimo }
   DEVUELVE: El producto recién creado con su ID asignado por MySQL
---------------------------------------------------------------- */
router.post('/', adminMiddleware, async (req, res) => {
  const { nombre, categoria, precio, imagen, destacado, proveedor, stock, stock_minimo } = req.body;

  if (!nombre || !categoria || !precio)
    return res.status(400).json({ error: 'Nombre, categoría y precio son obligatorios.' });

  try {
    // Verificar que la categoría existe en la tabla de categorías
    const [cat] = await db.query('SELECT id FROM categorias WHERE nombre = ?', [categoria]);
    if (!cat.length)
      return res.status(400).json({ error: 'La categoría especificada no existe.' });
    const [result] = await db.query(
      'INSERT INTO productos (nombre, categoria, precio, imagen, destacado, proveedor, stock, stock_minimo) VALUES (?,?,?,?,?,?,?,?)',
      [nombre, categoria, precio,
       imagen || null,       // si no mandaron imagen, guardamos NULL
       destacado ? 1 : 0,    // MySQL usa 1/0 para booleanos (true/false)
       proveedor || null,    // proveedor es opcional
       stock === undefined || stock === null || stock === '' ? 0 : +stock,
       stock_minimo === undefined || stock_minimo === null || stock_minimo === '' ? 5 : +stock_minimo]
    );

    // Después de insertar, consultamos el producto para devolverlo completo
    // (con todos los campos tal como quedaron en la BD, incluyendo el ID)
    const [rows] = await db.query('SELECT * FROM productos WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
    // 201 = "Creado". Es más específico que 200 para indicar que se creó algo nuevo.
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto.' });
  }
});

/* ----------------------------------------------------------------
   RUTA: PUT /api/productos/:id
   PROPÓSITO: Actualizar todos los datos de un producto existente.
   ACCESO: Solo administradores
   RECIBE: { nombre, categoria, precio, imagen, destacado, proveedor }
   DEVUELVE: El producto con los datos ya actualizados

   ¿POR QUÉ PUT Y NO PATCH?
   PUT reemplaza el objeto completo (mandas todos los campos).
   PATCH actualiza solo los campos que mandas.
   Usamos PUT porque el formulario de edición siempre manda todos los campos.
---------------------------------------------------------------- */
router.put('/:id', adminMiddleware, async (req, res) => {
  const { nombre, categoria, precio, imagen, destacado, proveedor, stock, stock_minimo } = req.body;
  try {
    // Verificar que la categoría existe
    if (categoria) {
      const [cat] = await db.query('SELECT id FROM categorias WHERE nombre = ?', [categoria]);
      if (!cat.length)
        return res.status(400).json({ error: 'La categoría especificada no existe.' });
    }
    await db.query(
      'UPDATE productos SET nombre=?, categoria=?, precio=?, imagen=?, destacado=?, proveedor=?, stock=?, stock_minimo=? WHERE id=?',
      [nombre, categoria, precio, imagen || null, destacado ? 1 : 0, proveedor || null,
       stock === undefined || stock === null || stock === '' ? 0 : +stock,
       stock_minimo === undefined || stock_minimo === null || stock_minimo === '' ? 5 : +stock_minimo,
       req.params.id]
    );
    // WHERE id=? limita la actualización al producto específico.
    // Sin WHERE, actualizaría TODOS los productos, lo que sería un desastre.

    const [rows] = await db.query('SELECT * FROM productos WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar producto.' });
  }
});

/* ----------------------------------------------------------------
   RUTA: PATCH /api/productos/:id/stock
   PROPÓSITO: Ajuste RÁPIDO de inventario (botones +/- de la tabla del
   admin), sin tener que abrir el modal completo de edición.
   ACCESO: Solo administradores
   RECIBE: { delta } → un número entero, positivo para sumar
           (ej: llegó mercancía) o negativo para restar (ej: producto
           dañado/perdido). El descuento automático por VENTAS pasa
           por otro camino: ver validarYDescontarStock en pedidos.js.
   DEVUELVE: El producto con el stock ya actualizado.
---------------------------------------------------------------- */
router.patch('/:id/stock', adminMiddleware, async (req, res) => {
  const delta = parseInt(req.body.delta, 10);
  if (!Number.isInteger(delta))
    return res.status(400).json({ error: 'delta debe ser un número entero.' });

  try {
    // GREATEST(...,0) evita que el stock quede en negativo si alguien
    // resta más de lo que hay disponible.
    await db.query(
      'UPDATE productos SET stock = GREATEST(stock + ?, 0) WHERE id = ?',
      [delta, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM productos WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al ajustar el stock.' });
  }
});

/* ----------------------------------------------------------------
   RUTA: DELETE /api/productos/:id
   PROPÓSITO: "Eliminar" un producto del catálogo.
   ACCESO: Solo administradores

   ¿POR QUÉ NO BORRAMOS REALMENTE?
   Si borramos el producto de la BD, los pedidos anteriores que
   lo incluyen quedarían con una referencia a un producto que ya
   no existe, rompiendo el historial de compras.

   La solución es "SOFT DELETE" (borrado suave):
   En lugar de borrar la fila, marcamos activo = 0.
   El producto sigue en la BD pero no aparece en el catálogo.
   Todos los pedidos anteriores siguen siendo válidos.
---------------------------------------------------------------- */
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await db.query('UPDATE productos SET activo = 0 WHERE id = ?', [req.params.id]);
    // activo = 0 hace que la ruta GET filtre este producto con WHERE activo = 1
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar producto.' });
  }
});

module.exports = router;
