/* ================================================================
   ARCHIVO: backend/routes/auth.js
   PROPÓSITO: Manejar el registro de nuevas cuentas, el inicio
   de sesión y la verificación de sesiones activas.

   ¿CÓMO FUNCIONA EL SISTEMA DE AUTENTICACIÓN?

   REGISTRO:
     Usuario llena formulario → frontend llama POST /api/auth/registro
     → encriptamos contraseña → guardamos en BD → generamos token
     → devolvemos token al frontend → frontend lo guarda en localStorage

   LOGIN:
     Usuario ingresa email/contraseña → POST /api/auth/login
     → buscamos en BD → comparamos contraseña con hash guardado
     → si coincide: generamos token → frontend lo guarda

   SESIÓN ACTIVA:
     En cada página → frontend envía token en cada petición
     → authMiddleware lo verifica → si es válido, procesa la petición

   ¿POR QUÉ ENCRIPTAMOS LA CONTRASEÑA?
   Si guardamos la contraseña en texto plano ("mi_password123") y
   alguien hackea la base de datos, tendrían acceso a TODAS las
   contraseñas. Con bcrypt, guardamos un "hash" irreversible.
   Nadie puede saber la contraseña original leyendo el hash.
================================================================ */

const router  = require('express').Router();
// Router es una mini-aplicación de Express. Nos permite definir rutas
// en archivos separados y luego registrarlas en server.js con un prefijo.

const bcrypt  = require('bcryptjs');
// bcryptjs es la librería para encriptar contraseñas de forma segura.
// Usa el algoritmo bcrypt, diseñado específicamente para contraseñas:
// es INTENCIONALMENTE lento (para que los hackers tarden años en romperlo).

const jwt     = require('jsonwebtoken');
// Para generar los tokens de sesión

const db      = require('../db');
// Nuestra conexión a la base de datos

const rateLimit = require('express-rate-limit');
// Limita intentos de PUT /me: sin esto, alguien con una sesión válida
// podía probar la contraseña actual de la cuenta sin límite de
// intentos (fuerza bruta contra passwordActual). Solo se aplica a
// esta ruta — GET /me se llama en cada carga de página y no debe
// limitarse.
const meLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos. Espera unos minutos.' }
});

/* ----------------------------------------------------------------
   RUTA: POST /api/auth/registro
   PROPÓSITO: Crear una cuenta nueva en el sistema.
   ACCESO: Público (cualquiera puede registrarse)
   RECIBE: { nombre, email, password }
   DEVUELVE: { token, user } → el frontend guarda el token
             y cierra el modal de registro automáticamente
---------------------------------------------------------------- */
router.post('/registro', async (req, res) => {
  const { nombre, email, password } = req.body;
  // req.body contiene el JSON que mandó el frontend.
  // Destructuring: sacamos las tres propiedades en variables separadas.

  // VALIDACIÓN 1: Todos los campos son obligatorios
  if (!nombre || !email || !password)
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });

  // VALIDACIÓN 2: Formato de email válido
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: 'El correo no tiene un formato válido.' });

  // VALIDACIÓN 3: Contraseña mínima de 6 caracteres
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

  try {
    // VALIDACIÓN 3: ¿Ya existe una cuenta con ese correo?
    const [existe] = await db.query(
      'SELECT id FROM usuarios WHERE email = ?', [email.toLowerCase().trim()]
    );
    // .toLowerCase().trim() → evitamos duplicados por mayúsculas o espacios
    // Ejemplo: "GERA@gmail.com" y "gera@gmail.com" serían el mismo correo

    if (existe.length)
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    // 409 = "Conflicto". El recurso (email) ya existe en el sistema.

    // ENCRIPTAR LA CONTRASEÑA antes de guardarla
    const hash = await bcrypt.hash(password, 10);
    // bcrypt.hash(texto, costFactor)
    // costFactor = 10 significa que el algoritmo hace 2^10 = 1024 iteraciones
    // internas. Esto hace que generar el hash tarde ~100ms intencionalmente,
    // lo que hace que un ataque de fuerza bruta tarde años.
    // NUNCA guardamos password directamente, siempre el hash.

    // INSERTAR el nuevo usuario en la base de datos
    const [result] = await db.query(
      'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?,?,?,?)',
      [nombre.trim(), email.toLowerCase().trim(), hash, 'cliente']
    );
    // Los ? son placeholders que mysql2 reemplaza de forma segura.
    // Esto previene "SQL Injection" (un tipo de ataque donde alguien
    // mete código SQL malicioso en los campos del formulario).
    // El rol siempre es 'cliente' al registrarse. Solo un admin puede
    // promover a otro usuario a admin.

    // Preparamos los datos del usuario para devolverlos
    const user  = { id: result.insertId, nombre: nombre.trim(), email: email.toLowerCase().trim(), rol: 'cliente' };
    // result.insertId = el ID que MySQL asignó automáticamente al nuevo usuario
    // NUNCA incluimos el hash en la respuesta

    const token = _signToken(user);
    // Generamos el token JWT con los datos del usuario.
    // El frontend lo guardará y lo enviará en cada petición futura.

    res.status(201).json({ token, user });
    // 201 = "Creado exitosamente"

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor.' });
    // 500 = error interno del servidor (algo que no anticipamos)
  }
});

/* ----------------------------------------------------------------
   RUTA: POST /api/auth/login
   PROPÓSITO: Verificar las credenciales e iniciar sesión.
   ACCESO: Público
   RECIBE: { email, password }
   DEVUELVE: { token, user }

   NOTA DE SEGURIDAD: En ambos casos de error (email no existe /
   contraseña incorrecta) devolvemos el MISMO mensaje de error.
   Esto es intencional: si dijéramos "email no registrado", un
   atacante sabría cuáles emails están registrados.
---------------------------------------------------------------- */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });

  try {
    // Buscamos el usuario por su correo en la BD
    const [rows] = await db.query(
      'SELECT * FROM usuarios WHERE email = ?', [email.toLowerCase().trim()]
    );

    if (!rows.length)
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    // 401 = "No autorizado". No decimos si el email existe o no.

    const user = rows[0]; // el primer (y único) resultado

    // COMPARAR la contraseña ingresada con el hash guardado
    const match = await bcrypt.compare(password, user.password);
    // bcrypt.compare es inteligente: aplica el mismo algoritmo a la
    // contraseña ingresada y compara el resultado con el hash guardado.
    // Devuelve true si coinciden, false si no.
    // Es IMPOSIBLE hacer esto al revés (obtener la contraseña del hash).

    if (!match)
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });

    // Login exitoso: generamos token con los datos del usuario
    const payload = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
    // Incluimos el rol en el token para que el middleware pueda
    // verificar si es admin sin consultar la BD en cada petición.

    const token = _signToken(payload);
    res.json({ token, user: payload }); // 200 por defecto = "OK"

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

/* ----------------------------------------------------------------
   RUTA: GET /api/auth/me
   PROPÓSITO: Verificar si el token del usuario sigue siendo válido.
   ACCESO: Requiere token (estar logueado)
   DEVUELVE: Los datos del usuario extraídos del token.

   ¿PARA QUÉ SIRVE?
   Cuando el usuario recarga la página, el frontend lee el token
   guardado en localStorage y llama a /me para saber si sigue
   siendo válido o ya venció (los tokens duran 7 días).
---------------------------------------------------------------- */
const { authMiddleware } = require('../middleware/auth');
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
  // req.user ya fue llenado por authMiddleware al verificar el token.
  // Esta es la ventaja del middleware: no repetimos código.
});

/* ----------------------------------------------------------------
   RUTA: PUT /api/auth/me
   PROPÓSITO: Que el usuario logueado edite su propio nombre/email
   y, opcionalmente, su contraseña. (Distinto de las rutas de
   /usuarios, que son solo para que un ADMIN gestione a otros).
   ACCESO: Requiere estar logueado (cualquier rol)
   RECIBE: { nombre, email, passwordActual?, passwordNueva? }
   DEVUELVE: { token, user } → un token NUEVO con los datos
             actualizados, para que el frontend lo reemplace y el
             saludo/nombre se actualice sin tener que reiniciar sesión.
---------------------------------------------------------------- */
router.put('/me', authMiddleware, meLimiter, async (req, res) => {
  const { nombre, email, passwordActual, passwordNueva } = req.body;

  if (!nombre || !email)
    return res.status(400).json({ error: 'Nombre y correo son obligatorios.' });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: 'El correo no tiene un formato válido.' });

  try {
    const emailLimpio = email.toLowerCase().trim();

    // ¿El correo ya lo usa OTRA cuenta? (excluimos la propia con id != ?)
    const [existe] = await db.query(
      'SELECT id FROM usuarios WHERE email = ? AND id != ?', [emailLimpio, req.user.id]
    );
    if (existe.length)
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });

    // Si el usuario quiere cambiar su contraseña, validamos la actual primero
    let nuevoHash = null;
    if (passwordNueva) {
      if (!passwordActual)
        return res.status(400).json({ error: 'Ingresa tu contraseña actual para cambiarla.' });
      if (passwordNueva.length < 6)
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });

      const [rows] = await db.query('SELECT password FROM usuarios WHERE id = ?', [req.user.id]);
      if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado.' });

      const match = await bcrypt.compare(passwordActual, rows[0].password);
      if (!match) return res.status(401).json({ error: 'Tu contraseña actual es incorrecta.' });

      nuevoHash = await bcrypt.hash(passwordNueva, 10);
    }

    if (nuevoHash) {
      await db.query(
        'UPDATE usuarios SET nombre = ?, email = ?, password = ? WHERE id = ?',
        [nombre.trim(), emailLimpio, nuevoHash, req.user.id]
      );
    } else {
      await db.query(
        'UPDATE usuarios SET nombre = ?, email = ? WHERE id = ?',
        [nombre.trim(), emailLimpio, req.user.id]
      );
    }

    // El token viejo tiene el nombre/email ANTIGUOS. Generamos uno nuevo
    // para que el frontend lo reemplace y todo quede sincronizado.
    const user  = { id: req.user.id, nombre: nombre.trim(), email: emailLimpio, rol: req.user.rol };
    const token = _signToken(user);

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
});

/* ----------------------------------------------------------------
   FUNCIÓN PRIVADA: _signToken
   Genera un token JWT que dura 7 días.
   El prefijo _ es una convención para indicar que es de uso
   interno de este archivo (no se exporta).

   ¿QUÉ CONTIENE EL TOKEN?
   El payload (carga) que le pasamos: { id, nombre, email, rol }
   Está "firmado" con JWT_SECRET del .env. Si alguien modifica el
   token (ej: cambia su rol a "admin"), la firma no coincidirá y
   jwt.verify lo rechazará.
---------------------------------------------------------------- */
function _signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
  // expiresIn: '7d' → el token vence en 7 días.
  // Después de eso, el usuario tendrá que volver a hacer login.
}

module.exports = router;
