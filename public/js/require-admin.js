/* ================================================================
   ARCHIVO: public/js/require-admin.js
   PROPÓSITO: Reemplaza el <script>if (!isAdmin())...</script> inline
   que tenía admin.html. Protección: si quien entra no es admin, lo
   redirige de inmediato al inicio.

   Se sacó a un archivo aparte (igual que require-login.js) para
   poder usar una Content-Security-Policy con script-src 'self' sin
   'unsafe-inline' — ver backend/server.js.
================================================================ */
if (!isAdmin()) window.location.replace('index.html');
