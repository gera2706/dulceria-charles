# Auditoría 2 — Julio 2026

Más profunda y reciente que [AUDITORIA_2026-06.md](AUDITORIA_2026-06.md). Se generó primero un informe completo (5 críticos, 7 importantes, 16 mejoras, 9 buenas prácticas) y luego se aplicaron todos los críticos e importantes más las mejoras, incluyendo eliminar el sistema de cupones por completo.

## Ronda 1 — Auditoría inicial y correcciones

### Cambios estructurales grandes

- **Reestructuración a `public/`:** todo el frontend (html/css/js/img) se movió de la raíz a `public/`. `backend/server.js` ahora sirve `express.static` solo desde ahí — antes servía la raíz completa, exponiendo `backend/db.js`, `backend/server.js` y el `.sql` con el hash del admin **sin autenticación** (hallazgo crítico #1).
- **Cupones eliminados por completo:** tabla `cupones` y sus INSERTs fuera del SQL, `backend/routes/cupones.js` borrado, su mount en `server.js` quitado, `apiValidarCupon` fuera de `api.js`, CSS `.coupon-box`/`.coupon-msg` fuera de `carrito.css`, columnas `cupon`/`descuento` fuera de `pedidos`.
- **Precio/cantidad ya no se confían del cliente:** `backend/routes/pedidos.js` reescrito — `construirItemsValidados()` busca el precio real en `productos` por cada item (ignora lo que mande el navegador), `calcularTotal()` calcula subtotal/total en servidor. `js/pago.js` ya solo manda `items` en el body.
- **Tabla `configuracion` integrada** al SQL consolidado (antes solo vivía en un script de migración nunca aplicado — el mismo bug que ya había pasado con `categorias`). Datos iniciales con la dirección real en vez de un placeholder.

### Seguridad

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | **Crítico:** raíz del proyecto expuesta sin auth (`db.js`, `server.js`, `.sql`) | `express.static` restringido a `public/` |
| 2 | **Crítico:** XSS — un cliente podía robar la sesión del admin usando su propio nombre | `escapeHtml()` global en `js/cart.js`, aplicada en `admin.js`, `cart.js`, `pago.js`, `carrito.js`, `pedidos.js`, `comprobante.js` |
| 3 | Fallo de conexión a BD podía tumbar el servidor | `db.getConnection()` movido dentro del try en las 4 rutas transaccionales de `pedidos.js` |
| 4 | Un pedido podía "reabrirse" o duplicar restauración de stock | `TRANSICIONES_VALIDAS` agregado |
| 5 | Sin red de seguridad ante rechazos de promesas no capturados | `process.on('unhandledRejection', ...)` en `server.js` |
| 6 | SVG permitido en subida de imágenes (vector de XSS almacenado) | Quitado de tipos permitidos en `upload.js` |
| 7 | Borrar usuario con pedidos daba 500 genérico | Ahora devuelve 409 explicativo |
| 8 | `PUT /me` sin límite de intentos (se podía probar `passwordActual` sin límite) | Rate limit agregado (20/15min) |

### Mejoras varias

- `PUT /api/productos/:id` valida campos obligatorios igual que POST *(nota: ver estado real en Ronda 2 — quedó pendiente)*.
- Papelera: `GET /api/productos/papelera` + `PATCH /api/productos/:id/reactivar` + modal en el admin para deshacer un soft-delete.
- `GET /api/pedidos` acepta `?estado=` para filtrar en servidor (usa `idx_estado`).
- CSS muerto de un checkout anterior (tarjeta/SPEI) eliminado de `pago.css`.
- `favoritos.html` sin CSS/JS inline — extraído a `css/favoritos.css`/`js/favoritos.js`.
- `showToast()` duplicado en `admin.js` eliminado (usa la global de `cart.js`).
- Cálculo de "total desde items si es 0" (duplicado en 3 archivos) extraído a `calcTotalPedido()`.
- Favicon (🍬 vía data URI) agregado a las 12 páginas.
- Validación de email en `login.html`/`mi-cuenta.html`. Validación de teléfono opcional en `contacto.html`.
- `aria-label` del botón hamburguesa alterna "Abrir menú"/"Cerrar menú".

### No se tocó a propósito

- `js/admin.js` (~850 líneas sin modularizar) — refactor grande y riesgoso para hacer a ciegas, se dejó fuera.
- `js/data.js` (fallback estático de 107 productos) no sincronizado con columnas nuevas (`stock`/`activo`) — el código ya lo tolera, mejora menor no crítica.
- `generar_doc.js` todavía menciona cupones extensamente — es contenido de reporte, no código en ejecución, no estaba en el pedido explícito.

### Verificado en Ronda 1

- `node --check` en todos los backend routes y JS del frontend tocados.
- Servidor Express real levantado localmente (sin MySQL): confirmado que `/db.js`, `/server.js`, `/dulceria_charles.sql` ya NO exponen su contenido, y `/api/cupones/*` da 404.
- Preview estático probado en navegador: catálogo, carrito y admin cargan sin errores de consola.
- **No probado end-to-end contra MySQL real:** el flujo completo de pedidos/checkout (`pago.js` → `pedidos.js`). Si algo falla en producción, revisar primero `construirItemsValidados`/`calcularTotal`.

---

## Ronda 2 — Verificación post-fix (2026-07-20)

Se re-auditó el estado real del repo con 3 agentes en paralelo. Veredicto: **21 de los ~26 hallazgos de la Ronda 1 se confirmaron bien resueltos** leyendo el código real.

### 🔴 Crítico — pendiente

**XSS en categorías (sobrevivió al barrido).** El escapado de la Ronda 1 cubrió nombre de usuario/pedido pero no el nombre/ícono de categoría:

- `renderCatIcon()` en `public/js/cat-icon.js` inserta `icono` **sin escapar** dentro de un `<img src="...">`.
- 3 consumidores en páginas públicas insertan `cat.nombre` sin escapar:
  - `public/js/catalogo.js:37-38`
  - `public/js/index.js:24-25`
  - `public/js/auth.js:145-148` (drawer de categorías — carga en las 12 páginas)
- Curiosamente `public/js/admin.js:617-625` sí escapa correctamente los mismos campos — el fix se aplicó donde el equipo miró (panel admin) pero no en los mismos datos consumidos por el frontend público.

### 🟠 Importantes — pendientes

| Hallazgo | Detalle |
|---|---|
| `backend/migrations/*.js` rotos | Los 6 scripts hacen `require('./db')` (debería ser `require('../db')`), no resuelven. Además contradicen el schema actual (ENUM viejo, datos de contacto distintos). Recomendado eliminar la carpeta completa. |
| `generar_doc.js` desactualizado | Todavía describe extensamente el sistema de cupones eliminado (RF-23, tabla, endpoints, Anexo C) — el entregable de documentación contradice el código real. |
| `comprobante.html` con CSS inline | Quedó como la única página sin extraer su CSS (el fix solo se aplicó a `favoritos.html`). |
| `PUT /api/productos/:id` sin validar | Único pendiente real de la Ronda 1 — confirmado que nunca se corrigió. |

### 🟡 Mejoras triviales — pendientes

- Selector `.coupon-box` huérfano en `public/css/style.css:523`.
- `<hr/>` duplicado en `public/pago.html:155-156`.

### Lección de proceso

Una sesión posterior, por un gap de contexto, casi vuelve a "corregir" todo desde cero sin darse cuenta de que ya estaba hecho. Se detectó a tiempo leyendo `server.js` directamente. Lección: **siempre verificar `git log`/`git status`/el archivo real antes de asumir el estado a partir de la memoria de la conversación.**

---

## Resumen de pendientes actuales

1. 🔴 XSS en categorías — `cat-icon.js` + 3 consumidores públicos
2. 🟠 Eliminar `backend/migrations/` (roto y contradictorio)
3. 🟠 Actualizar `generar_doc.js` (quitar referencias a cupones)
4. 🟠 Extraer CSS inline de `comprobante.html`
5. 🟠 Validar campos obligatorios en `PUT /api/productos/:id`
6. 🟡 Quitar `.coupon-box` huérfano de `style.css:523`
7. 🟡 Quitar `<hr/>` duplicado de `pago.html:155-156`
