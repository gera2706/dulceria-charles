-- ============================================================
--  MIGRACIÓN DE AUDITORÍA — Dulcería Charles
--  Ejecutar en MySQL Workbench sobre la BD existente.
--  Solo necesario si la BD ya estaba creada antes.
-- ============================================================

USE dulceria_charles;

-- ── 1. Cambiar categoria de ENUM a VARCHAR en productos ───────
-- Esto permite usar categorías creadas dinámicamente desde el admin.
ALTER TABLE productos
  MODIFY COLUMN categoria VARCHAR(100) NOT NULL;

-- Agregar columna proveedor si no existe
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS proveedor VARCHAR(150) NULL AFTER activo;

-- ── 2. Agregar índices de rendimiento ─────────────────────────
ALTER TABLE productos
  ADD INDEX IF NOT EXISTS idx_activo_cat (activo, categoria),
  ADD INDEX IF NOT EXISTS idx_destacado  (destacado);

ALTER TABLE pedidos
  ADD INDEX IF NOT EXISTS idx_usuario_id (usuario_id),
  ADD INDEX IF NOT EXISTS idx_estado     (estado);

ALTER TABLE pedido_items
  ADD INDEX IF NOT EXISTS idx_pedido_id (pedido_id);

ALTER TABLE favoritos
  ADD INDEX IF NOT EXISTS idx_fav_usuario (usuario_id);

-- ── 3. Corregir ENUM de estados en pedidos ────────────────────
-- Los estados deben coincidir con los que usa el backend.
ALTER TABLE pedidos
  MODIFY COLUMN estado
    ENUM('pendiente_finalizar','pendiente_entregar','entregado','cancelado')
    DEFAULT 'pendiente_finalizar';

-- ── 4. Eliminar columnas de envío que no se usan (modelo pickup) ──
ALTER TABLE pedidos
  DROP COLUMN IF EXISTS direccion,
  DROP COLUMN IF EXISTS ciudad,
  DROP COLUMN IF EXISTS cp;

-- ── 5. Agregar FK de pedido_items → productos (si no existe) ──
-- ON DELETE SET NULL: si se elimina un producto, el item del pedido
-- conserva nombre y precio históricos pero pierde la referencia.
SET FOREIGN_KEY_CHECKS = 0;
ALTER TABLE pedido_items
  ADD CONSTRAINT IF NOT EXISTS fk_item_producto
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL;
SET FOREIGN_KEY_CHECKS = 1;

-- ── 6. Cambiar contraseña del admin ───────────────────────────
-- Nueva contraseña: Charles2026!
-- IMPORTANTE: Cambia esto por una contraseña propia antes de producción.
UPDATE usuarios
  SET password = '$2a$10$rqwGpNCIKKwQHsdl15PMYe3Op0Xg/CyK.EAwuSscFwo4LI758axc.'
  WHERE email = 'admin@dulceriacharles.com';

-- ── Verificación final ────────────────────────────────────────
SELECT 'Migración completada correctamente.' AS resultado;
