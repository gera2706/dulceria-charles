-- ============================================================
--  Crear un usuario de MySQL dedicado para la app (no usar root)
--  Auditoría 2026-07-30, hallazgo crítico: la app se conectaba
--  como root, con privilegios totales sobre TODO el servidor
--  MySQL, no solo sobre dulceria_charles.
--
--  CÓMO USARLO:
--  1. Ejecuta este script completo en MySQL Workbench (conectado
--     como root, como siempre).
--  2. Reemplaza 'CAMBIA_ESTA_CONTRASEÑA' por una contraseña fuerte
--     antes de ejecutar (no dejes la que aparece abajo).
--  3. En backend/.env, cambia:
--       DB_USER=dulceria_app
--       DB_PASSWORD=<la contraseña que pusiste aquí>
--  4. Reinicia el servidor (npm start / npm run dev).
-- ============================================================

CREATE USER IF NOT EXISTS 'dulceria_app'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_CONTRASEÑA';

GRANT SELECT, INSERT, UPDATE, DELETE
  ON dulceria_charles.* TO 'dulceria_app'@'localhost';

FLUSH PRIVILEGES;

-- Este usuario NO tiene permisos de CREATE/DROP/ALTER: para volver a
-- ejecutar dulceria_charles.sql completo (que borra y recrea la BD)
-- sigue usando la cuenta root como hasta ahora. dulceria_app es solo
-- para que el servidor Node.js opere el día a día con privilegios
-- mínimos.
