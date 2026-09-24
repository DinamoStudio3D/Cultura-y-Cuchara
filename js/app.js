/* Visita Loja — cargador incremental de módulos.
 * Permite migrar funcionalidades fuera de index.html sin rehacer la web de golpe.
 */
(function () {
  'use strict';

  function loadStylesheet(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  loadStylesheet('css/mobile-ui.css');
  loadScript('js/mobile-ui.js').catch(console.error);

  // mi-ruta.js se activará cuando retiremos del index.html la implementación
  // equivalente, evitando ejecutar dos versiones de la misma lógica.
})();
