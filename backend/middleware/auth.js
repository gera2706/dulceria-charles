/* ================================================================
   ARCHIVO: backend/middleware/auth.js
   PROPÓSITO: Verificar la identidad del usuario antes de
   permitirle acceder a rutas protegidas.

   ¿QUÉ ES UN MIDDLEWARE?
   Es una función que se ejecuta EN MEDIO del camino entre que
   llega una petición y el código que la procesa.
   Es como un guardia de seguridad en la puerta:
     Petición → [guardia revisa] → código de la ruta

   ¿QUÉ ES UN TOKEN JWT?
   JWT = JSON Web Token. Cuando un usuario inicia sesión, el
   servidor le entrega un "pase" (token) que contiene sus datos
   encriptados. En cada petición posterior el usuario presenta
   ese pase, y el servidor lo verifica sin necesidad de consultar
   la base de datos.

   Ejemplo visual del token (se ve así en el navegador):
   eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwiZW1haWwiOiJ...
   [cabecera].[carga con datos del usuario].[firma de seguridad]

   ¿POR QUÉ NO GUARDAR LA SESIÓN EN LA BASE DE DATOS?
   Podríamos, pero los JWT son más eficientes: el servidor no
   necesita hacer una consulta SQL cada vez que alguien hace una
   petición. Solo descifra el token y ya tiene los datos del usuario.
================================================================ */

const jwt = require('jsonwebtoken');
// jsonwebtoken es la librería para crear y verificar tokens JWT

/* ----------------------------------------------------------------
   FUNCIÓN: authMiddleware
   ¿CUÁNDO SE USA? En rutas que requieren estar LOGUEADO pero no
   necesariamente ser admin. Ejemplo: ver mis pedidos, mis favoritos.

   FLUJO COMPLETO:
   1. El navegador manda la petición con el header:
      Authorization: Bearer eyJhbGci...
   2. Esta función lee ese header
   3. Extrae el token (quitando la palabra "Bearer ")
   4. Verifica que el token sea auténtico con la clave secreta del .env
   5a. Si es válido → guarda los datos del usuario en req.user
       y llama a next() para continuar a la ruta
   5b. Si no es válido (vencido, falso, modificado) → responde con
       error 401 y la petición no llega a la ruta
---------------------------------------------------------------- */
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  // req.headers contiene todos los encabezados HTTP de la petición.
  // 'authorization' es el estándar para enviar credenciales.

  if (!header) return res.status(401).json({ error: 'No autorizado' });
  // 401 = "No autorizado". Si no viene el header, rechazamos aquí mismo.
  // return corta la ejecución para que no siga al siguiente if.

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  // El estándar dice que el token debe venir como: "Bearer TOKEN"
  // slice(7) corta los primeros 7 caracteres ("Bearer ") para quedarse
  // solo con el token. El ? : es un if-else en una línea.

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    // jwt.verify hace dos cosas:
    // 1. Verifica que la FIRMA del token sea válida (nadie lo modificó)
    // 2. Verifica que no esté VENCIDO (los nuestros duran 7 días)
    // Si todo está bien, devuelve el contenido del token (id, nombre, rol, etc.)
    // y lo guardamos en req.user para que la ruta pueda usarlo.

    next();
    // next() le dice a Express "todo está bien, continúa al siguiente
    // middleware o a la función de la ruta". Sin este llamado, la
    // petición quedaría "colgada" sin respuesta.
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
    // El try/catch captura los errores que lanza jwt.verify cuando:
    // - El token fue modificado (firma no coincide)
    // - El token ya venció (después de 7 días)
    // - El formato del token es incorrecto
  }
}

/* ----------------------------------------------------------------
   FUNCIÓN: adminMiddleware
   ¿CUÁNDO SE USA? En rutas que solo los ADMINISTRADORES pueden usar.
   Ejemplo: agregar productos, ver todos los pedidos, gestionar usuarios.

   Es una EXTENSIÓN de authMiddleware: primero verifica que esté
   logueado (usando authMiddleware), y luego verifica el rol.

   ¿POR QUÉ NO VERIFICAR EL ROL EN EL FRONTEND SOLAMENTE?
   Porque el frontend puede ser manipulado por cualquier persona
   con conocimientos técnicos. La verificación en el backend es
   la que realmente importa y no puede ser saltada.
---------------------------------------------------------------- */
function adminMiddleware(req, res, next) {
  // Primero reutilizamos authMiddleware para verificar el token
  authMiddleware(req, res, () => {
    // Si llegamos aquí, el token es válido y req.user está disponible.
    // Ahora solo verificamos si el rol es "admin".
    if (req.user.rol !== 'admin')
      return res.status(403).json({ error: 'Acceso restringido a administradores' });
    // 403 = "Prohibido". Diferente al 401: aquí SÍ está identificado
    // pero NO tiene permiso. Es como tener credencial de empleado
    // pero no de gerente.

    next(); // Es admin, puede continuar
  });
}

module.exports = { authMiddleware, adminMiddleware };
// Exportamos ambas funciones para usarlas en los archivos de rutas así:
// const { authMiddleware, adminMiddleware } = require('../middleware/auth');
