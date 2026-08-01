const cron = require('node-cron');
const generarRespaldo = require('../services/backupService');

// Respaldo automático
// Se ejecuta todos los domingos a las 10:00 PM
cron.schedule('22 09 * * *', () => {

    console.log("=================================");
    console.log("Iniciando respaldo automático...");
    console.log("=================================");

    generarRespaldo();

});

console.log(" Programador de tareas iniciado.");