/* ================================================================
   ARCHIVO: backend/utils/stockAlertas.js
   PROPÓSITO: Detectar cuándo un producto cruza el umbral de "stock
   bajo" o se agota, avisar al dueño por correo, y dejar constancia
   en la tabla avisos_stock para que se vea en el panel admin.

   ¿CUÁNDO SE LLAMA?
   Después de CUALQUIER operación que pueda bajar el stock de un
   producto: confirmar un pedido (routes/pedidos.js) o que el admin
   ajuste el stock a mano (routes/productos.js).

   ¿CÓMO EVITA MANDAR UN CORREO POR CADA VENTA?
   productos.alerta_stock_enviada guarda el ÚLTIMO nivel ('ninguna',
   'bajo' o 'agotado') que ya se avisó para ese producto. Solo se
   manda un correo nuevo cuando el nivel EMPEORA respecto al último
   aviso (ninguna→bajo, ninguna→agotado, bajo→agotado). Si el stock
   sube de nuevo (reabastecimiento) por encima del umbral, el nivel
   se resetea a 'ninguna' en silencio — sin correo — para que la
   próxima vez que se agote vuelva a avisar.
================================================================ */

const mailer   = require('../mailer');
const whatsapp = require('../whatsapp');

/* Calcula en qué nivel de alerta está un producto ahora mismo. */
function calcularNivel(stock, stockMinimo) {
  if (stock <= 0) return 'agotado';
  if (stock <= stockMinimo) return 'bajo';
  return 'ninguna';
}

/* ----------------------------------------------------------------
   revisarAlertaStock(conn, productoId)
   conn: conexión/pool con .query() (puede ser el pool directo o una
         conexión de una transacción ya abierta — ambos exponen .query).
   Lee el producto, compara su nivel actual contra el último avisado,
   y si empeoró: manda el correo, inserta en avisos_stock y actualiza
   alerta_stock_enviada. Si mejoró (se repuso stock), solo resetea la
   columna sin avisar. No lanza errores hacia arriba — un fallo aquí
   (ej. el correo no salió) no debe tumbar la venta ni el pedido.
---------------------------------------------------------------- */
async function revisarAlertaStock(conn, productoId) {
  if (!productoId) return;
  try {
    const [rows] = await conn.query(
      'SELECT nombre, stock, stock_minimo, alerta_stock_enviada FROM productos WHERE id = ?',
      [productoId]
    );
    if (!rows.length) return;

    const producto = rows[0];
    const nivelActual = calcularNivel(producto.stock, producto.stock_minimo);

    if (nivelActual === producto.alerta_stock_enviada) return; // sin cambios, nada que hacer

    if (nivelActual === 'ninguna') {
      // Se repuso stock por encima del umbral: reset silencioso, sin correo.
      await conn.query('UPDATE productos SET alerta_stock_enviada = ? WHERE id = ?', ['ninguna', productoId]);
      return;
    }

    // El nivel empeoró (ninguna→bajo, ninguna→agotado o bajo→agotado): avisar.
    await conn.query('UPDATE productos SET alerta_stock_enviada = ? WHERE id = ?', [nivelActual, productoId]);
    await conn.query(
      'INSERT INTO avisos_stock (producto_id, tipo, origen) VALUES (?,?,\'sistema\')',
      [productoId, nivelActual]
    );

    await mailer.enviarAlertaStock({
      nombre: producto.nombre,
      stock: producto.stock,
      stockMinimo: producto.stock_minimo,
      tipo: nivelActual,
      origen: 'sistema'
    });

    // WhatsApp es un canal aparte del correo — si no está configurado
    // (ver whatsapp.js) simplemente no hace nada, no rompe el flujo.
    const texto = nivelActual === 'agotado'
      ? 'Se agotó "' + producto.nombre + '" (stock: 0).'
      : '"' + producto.nombre + '" llegó a stock bajo (quedan ' + producto.stock + ').';
    await whatsapp.enviarWhatsAppDueno(texto);
  } catch (err) {
    console.error('Error al revisar/enviar alerta de stock para producto ' + productoId + ':', err);
  }
}

module.exports = { revisarAlertaStock, calcularNivel };
