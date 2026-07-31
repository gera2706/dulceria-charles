@echo off
REM ============================================================
REM  Respaldo de la base de datos dulceria_charles
REM  Auditoria 2026-07-30: no habia ninguna estrategia de respaldo
REM  de DATOS (el esquema si esta versionado en dulceria_charles.sql,
REM  pero eso no protege pedidos/usuarios reales ante un borrado
REM  accidental o falla de disco).
REM
REM  COMO USARLO A MANO:
REM    Doble clic en este archivo (o "respaldar_bd.bat" en una terminal).
REM
REM  COMO PROGRAMARLO A DIARIO (opcional, hazlo tu mismo):
REM    1. Abre "Programador de tareas" de Windows.
REM    2. Crear tarea basica > Diariamente > a la hora que prefieras.
REM    3. Accion: "Iniciar un programa" > selecciona este archivo .bat.
REM    4. Guarda. Los respaldos se acumulan en la carpeta respaldos\.
REM
REM  IMPORTANTE: un respaldo que nunca se probo restaurar no es un
REM  respaldo confiable. De vez en cuando, prueba crear una base de
REM  datos de prueba e importar uno de estos archivos para confirmar
REM  que si sirve.
REM ============================================================

set MYSQL_BIN="C:\Program Files\MySQL\MySQL Server 8.0\bin"
set DB_NAME=dulceria_charles
set DB_USER=root
set OUT_DIR=%~dp0respaldos

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set FECHA=%%c%%a%%b
set OUT_FILE=%OUT_DIR%\respaldo_%DB_NAME%_%FECHA%.sql

echo Creando respaldo en: %OUT_FILE%
%MYSQL_BIN%\mysqldump.exe -u %DB_USER% -p --single-transaction --routines %DB_NAME% > "%OUT_FILE%"

if %ERRORLEVEL% EQU 0 (
  echo Respaldo creado correctamente.
) else (
  echo ERROR al crear el respaldo. Revisa que MYSQL_BIN apunte a tu instalacion real de MySQL.
)
pause
