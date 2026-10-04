/* Meta Pixel — campanha "Conexões que importam" (Outubro/2026). Só roda nesta
   página estática; o app em Next.js (src/lib/client/pixel.ts) tem sua própria
   cópia equivalente para continuar rastreando PageView nas páginas internas. */
(function () {
  var PIXEL_ID = "4586184068378924";
  function fbq() {
    if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
    else fbq.queue.push(arguments);
  }
  if (!window.fbq) {
    window.fbq = fbq;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    window._fbq = fbq;
  }
  var script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  window.fbq("init", PIXEL_ID);
  window.fbq("track", "PageView");
})();
