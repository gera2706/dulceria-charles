# 🔍 Auditoría técnica — Base de datos Dulcería Charles

Revisión de estructura, integridad, seguridad, rendimiento y escalabilidad del esquema `dulceria_charles` y de la capa de acceso a datos (backend Node/Express + MySQL 8), a partir del esquema versionado y del estado real de la base de datos en ejecución.

- **Alcance:** esquema SQL, 8 tablas, 8 rutas de API
- **Motor:** MySQL 8 / InnoDB
- **Método:** lectura de esquema + inspección en vivo (`information_schema`) + revisión de código
- **Fecha:** 30 jul. 2026

## Calificaciones

| Métrica | Nota |
|---|---|
| Seguridad | 7/10 |
| Organización | 8/10 |
| Rendimiento | 6.5/10 |
| Escalabilidad | 6/10 |

## Índice

1. [Resumen ejecutivo](#01-resumen-ejecutivo)
2. [Lo que ya está bien hecho](#02-lo-que-ya-está-bien-hecho)
3. [Estructura y organización](#03-estructura-y-organización-de-las-tablas)
4. [Relaciones y normalización](#04-relaciones-y-normalización)
5. [Integridad de datos](#05-integridad-de-los-datos)
6. [Seguridad](#06-seguridad)
7. [Rendimiento y escalabilidad](#07-rendimiento-y-escalabilidad)
8. [Nomenclatura y tipos de datos](#08-nomenclatura-y-tipos-de-datos)
9. [Respaldo y documentación](#09-respaldo-recuperación-y-documentación)
10. [Plan de mejora por prioridad](#10-plan-de-mejora-por-prioridad)

---

## 01. Resumen ejecutivo

**El estado general es sólido para el tamaño actual del proyecto.** Es, con diferencia, la base de código estudiantil mejor defendida contra inyección SQL que se ha revisado: las **~40 consultas** repartidas en 8 archivos de rutas usan parámetros preparados (`?`) sin una sola excepción, los precios de un pedido siempre se recalculan del lado del servidor, y las operaciones sensibles a stock corren dentro de transacciones reales con bloqueo de fila (`FOR UPDATE`). Hay evidencia clara de que ya hubo una pasada de auditoría previa — varios comentarios en el código narran hallazgos corregidos (precios manipulables, archivos backend expuestos, transiciones de estado ilegales).

Dicho esto, quedan **4 hallazgos que sí deben corregirse antes de un entorno de producción real** (el más serio: la aplicación se conecta a MySQL como `root`), y una decena de mejoras de importancia media que afectan mantenibilidad y crecimiento — sobre todo la ausencia de paginación, que hoy no es un problema con 107 productos y 2 pedidos, pero sí lo será con miles.

## 02. Lo que ya está bien hecho

Antes de listar problemas, vale nombrar lo que ya cumple con buenas prácticas profesionales — para no corregir después algo que en realidad ya está resuelto.

- ✔ 100% de las consultas usan parámetros preparados (`?`) — no se encontró concatenación de strings con input del usuario en ningún archivo de `routes/`.
- ✔ Contraseñas con `bcrypt` (factor de costo 10), nunca devueltas en ninguna respuesta de la API.
- ✔ El precio y la cantidad de cada producto en un pedido **siempre** se leen de la tabla `productos` al momento de confirmar — el cliente no puede alterar el precio manipulando el JSON del carrito.
- ✔ Transacciones con `BEGIN/COMMIT/ROLLBACK` y `SELECT ... FOR UPDATE` al descontar stock: dos compras simultáneas del último artículo no pueden sobrevender.
- ✔ Máquina de estados explícita para pedidos (`TRANSICIONES_VALIDAS`) — impide reabrir un pedido cancelado o duplicar la restauración de stock.
- ✔ Borrado suave (`activo=0`) en productos: los pedidos históricos no se rompen cuando un producto se retira del catálogo.
- ✔ Protección contra quedarse sin administradores: no se puede eliminar ni degradar al último admin del sistema.
- ✔ `.env` correctamente ignorado por git, con un `.env.example` limpio; el backend ya no se sirve como archivo estático (comentario en `server.js` documenta ese fix).
- ✔ Subida de imágenes con lista blanca de extensión + mimetype, tamaño máximo y **SVG bloqueado a propósito** (vector de XSS almacenado) — un detalle que muchos proyectos pasan por alto.
- ✔ Índices alineados con los patrones de consulta reales (`idx_activo_cat`, `idx_estado`, `idx_activo_orden`…), no puestos al azar.
- ✔ `DECIMAL(10,2)` para dinero en vez de `FLOAT` — evita errores de redondeo.
- ✔ Comentarios técnicos excepcionalmente completos en prácticamente cada archivo — muy por encima del promedio para un proyecto de este tamaño.

## 03. Estructura y organización de las tablas

8 tablas, cada una con un propósito claro y sin solapamiento evidente. La nomenclatura es consistente (snake_case, español, patrón `<entidad>_id` para llaves foráneas). No hay tablas vacías ni claramente obsoletas.

| Tabla | Propósito | Filas hoy |
|---|---|---:|
| `usuarios` | Cuentas (clientes y admins) | 3 |
| `categorias` | Categorías dinámicas del catálogo | 8 |
| `productos` | Catálogo | 107 |
| `pedidos` | Cabecera de pedido (modelo pickup) | 2 |
| `pedido_items` | Detalle de cada pedido, congelado al momento de compra | 3 |
| `favoritos` | Relación N:M usuario↔producto | 3 |
| `configuracion` | Clave→valor para datos de contacto del sitio | 9 |
| `chatbot_faq` | Preguntas frecuentes del chatbot del sitio | 6 |

Ninguna tabla debería fusionarse ni dividirse. La única que vale la pena señalar es `configuracion`: es un patrón **EAV** (clave→valor) — flexible para agregar ajustes sin migraciones, pero sin tipado ni validación por clave a nivel de base de datos. Es una decisión razonable dado su volumen (9 filas, solo el admin escribe), así que no se marca como hallazgo — solo como algo a tener presente si algún día necesita crecer.

## 04. Relaciones y normalización

El esquema cumple 1FN, 2FN y 3FN en la práctica totalidad de las tablas. `pedido_items` duplica a propósito `nombre` y `precio` de `productos` — eso **no** es una violación de normalización, es una decisión correcta: congela el precio histórico para que un pedido de hace un año no cambie si el producto sube de precio hoy.

### 🟠 Alto — `productos.categoria` no tiene llave foránea real

- **Dónde:** `dulceria_charles.sql` — tabla `productos`, columna `categoria VARCHAR(100)`
- **Riesgo:** la integridad entre `productos.categoria` y `categorias.nombre` depende **solo** del código de la aplicación (`productos.js` valida antes de insertar/actualizar). Cualquier inserción que no pase por esa ruta — un script de migración, una corrección manual en Workbench, un futuro endpoint que se olvide validar — puede dejar productos con una categoría que no existe en ningún lado.
- **Por qué pasó:** el comentario en el SQL explica que evitaron `ENUM` a propósito porque rompería al crear categorías nuevas desde el panel — decisión correcta. Pero el paso siguiente (FK contra `categorias.nombre`, que ya es `UNIQUE`) no se dio.
- **Solución:**
  ```sql
  ALTER TABLE productos
    ADD CONSTRAINT fk_productos_categoria
    FOREIGN KEY (categoria) REFERENCES categorias(nombre)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
  ```
  Con `ON UPDATE CASCADE`, el `UPDATE productos SET categoria=? WHERE categoria=?` manual que hoy hace `categorias.js` al renombrar una categoría dejaría de ser necesario — MySQL lo haría solo.

### 🟡 Medio — `pedidos.subtotal` y `pedidos.total` siempre guardan el mismo valor

- **Dónde:** `backend/routes/pedidos.js` — `calcularTotal()` alimenta ambas columnas con el mismo número
- **Riesgo:** no es un error funcional, pero sí una columna redundante hoy: el proyecto no maneja impuestos, envío ni cupones (confirmado en los comentarios del propio SQL), así que `subtotal` y `total` jamás difieren.
- **Solución:** dos caminos válidos: (a) eliminar `subtotal` si de verdad no habrá diferenciación nunca, o (b) —recomendado, si algún día piensan agregar envío o descuentos— dejarla como está pero agregar un comentario explícito en el SQL aclarando que hoy son iguales a propósito, para que el próximo desarrollador no lo lea como un bug.

### 🟢 Bajo — Llaves foráneas sin nombre explícito

- **Dónde:** todas las FK del esquema (MySQL les puso nombres automáticos tipo `productos_ibfk_1`)
- **Riesgo:** ninguno funcional. Al depurar un error de integridad referencial en producción, un nombre como `fk_pedidos_usuarios` es mucho más rápido de identificar que `pedidos_ibfk_1`.
- **Solución:** nombrar las FK explícitamente la próxima vez que se toque el esquema: `CONSTRAINT fk_pedidos_usuarios FOREIGN KEY (usuario_id) REFERENCES usuarios(id)`.

## 05. Integridad de los datos

`NOT NULL`, `UNIQUE` y `DEFAULT` están bien aplicados donde importa (`usuarios.email`, `categorias.nombre`, `favoritos` con llave compuesta única). El hueco real es la ausencia total de `CHECK`.

### 🟡 Medio — Sin restricciones CHECK — la validación vive solo en Node

- **Riesgo:** hoy `precio > 0`, `stock >= 0` y `cantidad > 0` se validan en el backend, pero no en la base de datos misma. Es una sola capa de defensa: si en el futuro otro servicio, un script batch o un acceso directo a MySQL Workbench escribe en estas tablas, nada al nivel de la BD lo detiene.
- **Solución:**
  ```sql
  ALTER TABLE productos
    ADD CONSTRAINT chk_precio_positivo CHECK (precio > 0),
    ADD CONSTRAINT chk_stock_no_negativo CHECK (stock >= 0);

  ALTER TABLE pedido_items
    ADD CONSTRAINT chk_cantidad_positiva CHECK (cantidad > 0);
  ```
- **Nota:** MySQL 8.0.16+ ya soporta `CHECK` de forma nativa (antes se aceptaba en la sintaxis pero se ignoraba en silencio) — el proyecto usa MySQL 8, así que esto sí se hace cumplir de verdad.

### 🟢 Bajo — `pedidos.estado` admite NULL a pesar de tener DEFAULT

- **Riesgo:** en la práctica nunca queda en `NULL` porque la app siempre lo asigna, pero la columna lo permite. Un pedido con estado `NULL` se saldría silenciosamente de la máquina de estados (`TRANSICIONES_VALIDAS[null]` → `undefined` → tratado como "sin transiciones permitidas").
- **Solución:** `ALTER TABLE pedidos MODIFY estado ENUM(...) NOT NULL DEFAULT 'pendiente_finalizar';`

## 06. Seguridad

Esta es la sección con los hallazgos de mayor severidad del informe. Ninguno es "el código es vulnerable a inyección" — ese frente está cubierto — sino configuración de acceso y un par de puntos concretos de validación.

### 🔴 Crítico — La aplicación se conecta a MySQL como root

- **Dónde:** `backend/.env` — `DB_USER=root` (verificado en el entorno actual)
- **Riesgo:** el usuario `root` de MySQL tiene privilegios totales sobre **todas** las bases de datos del servidor, no solo `dulceria_charles`: puede crear/borrar bases de datos completas, crear otros usuarios, leer las tablas internas de `mysql.*`. Si alguna vez apareciera una vulnerabilidad en el backend (aunque hoy no hay ninguna de inyección SQL conocida), el radio de impacto pasaría de "esta tienda" a "todo el servidor de base de datos". Esto viola el **principio de mínimo privilegio**, que es la primera pregunta que hace cualquier revisión de seguridad sobre accesos.
- **Solución:**
  ```sql
  CREATE USER 'dulceria_app'@'localhost' IDENTIFIED BY 'una_contraseña_fuerte_distinta_a_root';

  GRANT SELECT, INSERT, UPDATE, DELETE
    ON dulceria_charles.* TO 'dulceria_app'@'localhost';

  FLUSH PRIVILEGES;
  ```
  Después, en `backend/.env`: `DB_USER=dulceria_app` y su contraseña. Este usuario no necesita `CREATE`/`DROP`/`ALTER` para el día a día — solo para migraciones, que se pueden correr puntualmente como root o con un segundo usuario de mantenimiento.

### 🟠 Alto — El link personalizado del chatbot no valida el esquema de la URL

- **Dónde:** `public/js/cart.js` — `chatAddLinkMessage()` asigna `a.href = href` directo con `accion_valor` de `chatbot_faq`, sin validar el esquema
- **Riesgo:** solo un admin puede escribir `accion_valor` hoy, así que no es explotable por un visitante anónimo — pero es exactamente el tipo de hallazgo que una auditoría debe señalar: si una cuenta admin se ve comprometida (contraseña reusada, phishing), el atacante puede guardar una pregunta con `accion_tipo: "link"` y `accion_valor: "javascript:..."`. Cualquier visitante que toque ese botón del chat ejecutaría ese script en su propio navegador — un XSS persistente que sobrevive aunque se recupere la cuenta del admin, hasta que alguien borre esa pregunta.
- **Solución:**
  ```js
  function esUrlSegura(url) {
    return /^https?:\/\//i.test(url) || url.startsWith('/');
  }
  // en chatAddLinkMessage, antes de asignar href:
  if (!esUrlSegura(href)) href = '#';
  ```
  Validar en dos lugares: al mostrar (arriba) y también al guardar en `backend/routes/chatbot_faq.js` (`validarDatos`), rechazando `accion_valor` que empiece con `javascript:`, `data:` o `vbscript:` cuando `accion_tipo === 'link'`.

### 🟡 Medio — JWT_SECRET más corto que lo recomendado por el propio proyecto

- **Dónde:** `backend/.env` — verificado: 35 caracteres
- **Riesgo:** el propio `.env.example` documenta el comando correcto (`crypto.randomBytes(32).toString('hex')`, que da 64 caracteres / 256 bits de entropía), pero el secreto actual no sigue esa receta. Un secreto más corto o con menos aleatoriedad real es, en teoría, más susceptible a fuerza bruta offline si algún día se filtrara el algoritmo/formato — aunque HS256 con 35 caracteres razonablemente aleatorios sigue siendo difícil de romper hoy, no hay razón para no usar el método completo que ya está documentado.
- **Solución:** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y reemplazar `JWT_SECRET`. Esto invalida todas las sesiones activas (los usuarios tendrán que volver a iniciar sesión) — normal y esperado.

### 🟡 Medio — Contraseña mínima de solo 6 caracteres

- **Dónde:** `backend/routes/auth.js` — `if (password.length < 6)`, en registro y en cambio de contraseña
- **Riesgo:** 6 caracteres es más corto que lo que recomiendan las guías actuales (NIST sugiere 8 como mínimo razonable, priorizando longitud sobre reglas de composición). No es explotable directamente, pero baja el costo de un ataque de fuerza bruta si el rate limiting fallara o se evadiera desde múltiples IPs.
- **Solución:** subir el mínimo a 8 en las dos validaciones (registro y `PUT /me`), y reflejarlo en el mensaje de error del frontend.

### 🟡 Medio — Token JWT en localStorage/sessionStorage, no en cookie httpOnly

- **Riesgo:** cualquier JavaScript que logre ejecutarse en el sitio (XSS) puede leer `localStorage`/`sessionStorage` y robar el token de sesión. Una cookie `httpOnly` no es legible desde JavaScript, así que un XSS no podría robarla directamente (aunque introduce su propia complejidad: hay que proteger contra CSRF).
- **Nota:** no se encontró ningún XSS reflejado o almacenado explotable en este momento (aparte del hallazgo del chatbot de arriba, que ya tiene su propia entrada) — esto es una recomendación de **defensa en profundidad**, no la corrección de un agujero activo. Es también el cambio de arquitectura más grande de este informe; no se recomienda hacerlo a la ligera sin planearlo.
- **Solución:** evaluarlo como proyecto aparte: mover la emisión del JWT a una cookie `httpOnly; Secure; SameSite=Strict` desde `_signToken`/las rutas de login, y actualizar `apiFetch` para dejar de mandar el header `Authorization` manualmente.

### 🟢 Bajo — Sin límite de tasa en endpoints públicos de lectura

- **Riesgo:** `rateLimit` hoy solo cubre login, registro y `PUT /me`. Endpoints como `GET /api/productos` no tienen límite — exposición baja (son datos públicos del catálogo de cualquier forma), pero sí abierta a scraping agresivo o un mini-DoS de aplicación.
- **Solución:** un `rateLimit` global y generoso (ej. 300 peticiones/15min por IP) sobre todo `/api/`, sin afectar el uso normal.

## 07. Rendimiento y escalabilidad

Con el volumen actual (107 productos, un puñado de pedidos) todo responde instantáneo — esta sección mira hacia adelante, a qué se rompe primero si la tienda crece.

### 🟠 Alto — Ningún listado tiene paginación

- **Dónde:** `GET /api/productos`, `GET /api/pedidos` (admin), `GET /api/pedidos/mios`, `GET /api/usuarios` — los cuatro devuelven la tabla completa en una sola respuesta.
- **Riesgo:** es el hallazgo de escalabilidad más importante del informe. `GET /api/pedidos` además hace `LEFT JOIN` con `usuarios` y `pedido_items` sin límite — con miles de pedidos, cada carga del dashboard de administración movería toda la tabla completa (y su JOIN) en cada petición. Hoy es invisible porque hay 2 pedidos; con 10,000 sería el primer cuello de botella real de la aplicación.
- **Solución:**
  ```sql
  SELECT ... FROM productos
  WHERE activo = 1
  ORDER BY id ASC
  LIMIT ? OFFSET ?;
  ```
  Agregar `?page=`/`?limit=` (o paginación por cursor con el `id`) a los cuatro endpoints, y actualizar el frontend para pedir la siguiente página en vez de todo de una vez.

### 🟡 Medio — La búsqueda de productos no puede usar índice

- **Dónde:** `backend/routes/productos.js` — `nombre LIKE '%' + q + '%'`
- **Riesgo:** un `%` al inicio del patrón hace que MySQL no pueda usar un índice B-tree normal aunque exista uno sobre `nombre` — siempre es un recorrido completo de tabla. A 107 filas es instantáneo; a 50,000 productos empezaría a notarse.
- **Solución:** `ALTER TABLE productos ADD FULLTEXT INDEX ft_nombre (nombre);` y cambiar la búsqueda a `MATCH(nombre) AGAINST(? IN NATURAL LANGUAGE MODE)` cuando el catálogo crezca — no es urgente hoy.

El resto del uso de índices está bien pensado: `idx_activo_cat`, `idx_estado`, `idx_activo_orden` coinciden exactamente con los filtros que usan las consultas reales — no es un patrón de "índice en cada columna por si acaso", que también sería un problema (cada índice de más ralentiza los `INSERT`/`UPDATE`). El pool de conexiones (`connectionLimit: 10`) es apropiado para el tamaño actual, y el propio comentario del código ya reconoce que un sitio grande necesitaría más — buena señal de que se pensó, no que se copió sin más.

## 08. Nomenclatura y tipos de datos

Consistente de principio a fin: tablas y columnas en snake_case y español, llaves foráneas siempre `<entidad>_id`, índices siempre `idx_<columna>`. No hace falta proponer un estándar nuevo — el que ya usan es razonable y se sigue sin excepciones.

Tipos de datos revisados uno por uno: `DECIMAL(10,2)` para dinero (correcto, nunca `FLOAT`), `VARCHAR(20)` para teléfono (correcto — un teléfono no es un número aritmético, puede llevar `+` o ceros a la izquierda), `ENUM` usado solo donde el conjunto de valores es fijo y controlado por código (`rol`, `estado`) y evitado a propósito donde es dinámico (`categoria`) — es exactamente la distinción correcta. `TEXT` en `configuracion.valor` y `chatbot_faq.respuesta` es apropiado para contenido de longitud variable sin un límite natural claro.

## 09. Respaldo, recuperación y documentación

### 🟡 Medio — Sin estrategia de respaldo definida

- **Riesgo:** el esquema (estructura) está versionado en git vía `dulceria_charles.sql`, lo cual está bien — pero eso no protege los **datos** (pedidos reales, usuarios reales) ante un borrado accidental o una falla de disco. No se encontró ningún script ni tarea programada de `mysqldump`.
- **Solución:**
  ```bash
  mysqldump -u dulceria_app -p dulceria_charles \
    --single-transaction --routines \
    > respaldo_$(date +%Y%m%d).sql
  ```
  Programado diario (Tarea Programada de Windows o un cron si se migra a Linux/hosting), guardando los últimos 7-14 respaldos y probando la restauración al menos una vez — un respaldo que nunca se probó restaurar no es un respaldo confiable.

En documentación, el proyecto está mejor de lo típico: los comentarios inline explican el *por qué* de decisiones no obvias (por ejemplo, por qué `categoria` no es `ENUM`, o por qué `pedido_items` duplica nombre/precio). Lo único que falta como artefacto independiente es un **diagrama entidad-relación** y un **diccionario de datos** — útiles el día que alguien más se sume al equipo y necesite entender el esquema sin leer los 8 archivos de rutas primero.

## 10. Plan de mejora por prioridad

Mismos hallazgos de arriba, organizados para decidir por dónde empezar.

### Prioridad alta

- **Usuario MySQL dedicado (no root)** — máximo impacto en seguridad, mínimo esfuerzo: un solo script SQL y una línea de `.env`.
- **Validar el esquema de accion_valor del chatbot** — cierra la vía de XSS persistente vía cuenta admin comprometida.
- **FK real en productos.categoria** — mueve una validación crítica de "solo en el código" a "garantizada por la base de datos".
- **Paginación en los 4 listados sin límite** — el único cambio de esta lista que requiere tocar también el frontend; planearlo con tiempo, no es urgente hoy pero sí bloqueante para crecer.

### Prioridad media

- **Regenerar JWT_SECRET** — con el comando ya documentado en `.env.example`.
- **Contraseña mínima de 8 caracteres** — cambio de una línea en dos validaciones.
- **Agregar CHECK constraints** — defensa en profundidad para precio/stock/cantidad.
- **Definir respaldo automático** — `mysqldump` programado + prueba de restauración.
- **FULLTEXT index para búsqueda de productos** — no urgente a 107 filas; sí antes de escalar el catálogo.
- **Evaluar JWT en cookie httpOnly** — cambio de arquitectura, planear aparte, no es un parche rápido.

### Prioridad baja

- **pedidos.estado NOT NULL** — cierra un caso borde teórico.
- **Nombrar las FK explícitamente** — solo mejora la depuración futura.
- **Rate limit global** — defensa adicional sobre endpoints ya públicos.
- **Diagrama ER + diccionario de datos** — documentación para cuando el equipo crezca.
- **Flujo de "olvidé mi contraseña"** — no es un hallazgo de seguridad, es un hueco funcional que van a necesitar con clientes reales.

---

*Metodología: lectura completa de `dulceria_charles.sql` y de los 8 archivos en `backend/routes/`, inspección en vivo del esquema vía `information_schema` (tablas, llaves foráneas, índices, nulabilidad) contra la base de datos en ejecución, y verificación de variables de entorno sensibles sin exponer sus valores reales en este informe.*

*Versión HTML con estilo original: [auditoria-seguridad-rendimiento-2026-07-30.html](auditoria-seguridad-rendimiento-2026-07-30.html)*
