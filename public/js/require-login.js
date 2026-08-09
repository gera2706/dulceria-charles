/* ================================================================
   ARCHIVO: public/js/require-login.js
   PROPÓSITO: Reemplaza el <script>requireLogin();</script> inline que
   tenían favoritos.html, mi-cuenta.html, pago.html y pedidos.html.

   ¿POR QUÉ SACARLO A UN ARCHIVO APARTE, SI ES UNA SOLA LÍNEA?
   Para poder poner una Content-Security-Policy con script-src 'self'
   (sin 'unsafe-inline') en backend/server.js — con un <script> inline
   en el HTML, el navegador lo bloquea bajo esa política. Sacándolo a
   un archivo .js normal (mismo origen), sigue funcionando igual pero
   ya no hace falta abrirle un hueco a la CSP.

   requireLogin() vive en auth.js, que cada una de esas páginas ya
   carga antes que este archivo.
================================================================ */
requireLogin();
