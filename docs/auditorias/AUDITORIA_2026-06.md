# Auditoría 1 — Junio 2026

**Fecha:** 2026-06-19
**Enfoque:** Preparar el proyecto para presentación/producción (seguridad básica, estructura de BD, rendimiento).

## Hallazgos y correcciones aplicadas

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | No existía `.gitignore` | Creado, excluye `.env` y `node_modules` |
| 2 | CORS abierto sin restricción | Configurado con origin específico |
| 3 | Sin límite de intentos en login/registro | Rate limiting: 10 intentos/15min en `/api/auth/login`, 5/hora en `/registro` |
| 4 | Sin validación de formato de email en registro | Validación agregada |
| 5 | **Crítico:** `categoria` en tabla `productos` era ENUM fijo | Cambiada a VARCHAR (permite agregar categorías sin migrar esquema) |
| 6 | ENUM de estados de `pedidos` no coincidía con el backend | Corregido |
| 7 | Columnas `direccion`, `ciudad`, `cp` en `pedidos` sin uso real | Eliminadas (el modelo es pickup, no envío a domicilio) |
| 8 | Consultas lentas por falta de índices | Índices agregados en `productos`, `pedidos`, `pedido_items`, `favoritos` |
| 9 | N+1 queries al listar pedidos | Eliminado con JOIN + función `agruparPedidosConItems` |
| 10 | Inserción de items de pedido duplicada en varios lugares | Centralizada en función `insertarItems` |
| 11 | Se podía borrar al único admin del sistema | Protección agregada en DELETE de usuarios |
| 12 | **Crítico:** hash de contraseña del admin era el hash público de ejemplo de Laravel | Regenerado con contraseña real |
| 13 | Scripts de migración sueltos en la raíz | Movidos a `backend/migrations/` |
| 14 | No había forma de aplicar los cambios a una BD ya existente | Script `migracion_auditoria.sql` creado |

## Actualización 2026-07-13 — Consolidación de SQL

- `migracion_auditoria.sql` y `migracion_inventario.sql` fueron **eliminados** (se consolidó todo a un solo archivo `dulceria_charles.sql`).
- `dulceria_charles.sql` ahora empieza con `DROP DATABASE IF EXISTS` + `CREATE DATABASE`: ejecutarlo completo borra y recrea la base desde cero cada vez. Ya no existe un camino de "migrar sin perder datos" — el usuario aceptó ese trade-off explícitamente.
- **Credenciales admin actuales:** `admin@dulceriacharles.com` / `admin123` (cambiado de `Charles2026!` el 2026-07-13 a petición del usuario).

## Estado

Todos los puntos de esta auditoría quedaron **resueltos**. Ver [AUDITORIA_2026-07.md](AUDITORIA_2026-07.md) para la auditoría más profunda y reciente, con hallazgos nuevos que esta primera pasada no cubrió.
