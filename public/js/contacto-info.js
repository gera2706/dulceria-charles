/* ================================================================
   ARCHIVO: public/js/contacto-info.js
   PROPÓSITO: Carga los datos de contacto (dirección, horario,
   teléfono, correo, WhatsApp) desde la API en la página Contacto.
   Antes vivía como <script> inline dentro de contacto.html, se sacó
   a este archivo (nombre distinto de contacto.js, que ya existe y
   maneja el formulario) para poder usar una Content-Security-Policy
   con script-src 'self' (sin 'unsafe-inline') en backend/server.js.
================================================================ */
(async function () {
  try {
    var cfg = await apiGetContacto();
    /* Dirección */
    var dir = (cfg.contacto_direccion || '') + (cfg.contacto_ciudad ? '<br/>' + cfg.contacto_ciudad : '');
    document.getElementById('ci-direccion').innerHTML = dir || '—';
    /* Horario — separado por | */
    var hor = (cfg.contacto_horario || '').split('|').join('<br/>');
    document.getElementById('ci-horario').innerHTML = hor || '—';
    /* Teléfono */
    document.getElementById('ci-telefono').textContent = cfg.contacto_telefono || '—';
    /* Email */
    document.getElementById('ci-email').textContent = cfg.contacto_email || '—';
    /* WhatsApp: getWaLink usa el link configurado o, si no hay, lo arma
       con el teléfono real (ver cart.js) */
    var waLink = getWaLink(cfg);
    if (waLink) document.getElementById('ci-whatsapp').href = waLink;
  } catch (e) {
    console.warn('No se pudo cargar la configuración de contacto:', e);
  }
})();
