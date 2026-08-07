const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function generarRespaldo() {

    const fecha = new Date();

    const nombreArchivo =
        `dulceria_charles_${fecha.getFullYear()}-${
            String(fecha.getMonth() + 1).padStart(2, "0")
        }-${
            String(fecha.getDate()).padStart(2, "0")
        }_${
            String(fecha.getHours()).padStart(2, "0")
        }-${
            String(fecha.getMinutes()).padStart(2, "0")
        }.sql`;

    const carpetaBackups = path.join(__dirname, "..", "backups");

    if (!fs.existsSync(carpetaBackups)) {
        fs.mkdirSync(carpetaBackups, { recursive: true });
    }

    const rutaArchivo = path.join(carpetaBackups, nombreArchivo);

    const salida = fs.createWriteStream(rutaArchivo);

    const mysqldump = spawn("mysqldump", [
    "-h", process.env.DB_HOST,
    "-P", process.env.DB_PORT,
    "-u", process.env.DB_USER,
    `--password=${process.env.DB_PASSWORD}`,

    "--single-transaction",
    "--routines",
    "--triggers",
    "--events",

    process.env.DB_NAME
]);

    mysqldump.stdout.pipe(salida);

    mysqldump.stderr.on("data", (data) => {
        console.error(data.toString());
    });

    mysqldump.on("close", (code) => {

        if (code === 0) {

            console.log("=================================");
            console.log("✅ RESPALDO GENERADO");
            console.log(rutaArchivo);
            console.log("=================================");

        } else {

            console.error("❌ Error al generar el respaldo.");
        }

    });

}

module.exports = generarRespaldo;