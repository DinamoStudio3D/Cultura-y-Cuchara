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

  // Este bloque de contacto/social inferior ya no forma parte del diseño de Visita Loja.
  function removeLegacyContactBlock() {
    document.querySelector('section[aria-label="Contacto de Visita Loja"]')?.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeLegacyContactBlock, { once: true });
  } else {
    removeLegacyContactBlock();
  }

  loadStylesheet('css/mobile-ui.css');
  loadScript('js/mobile-ui.js').catch(console.error);
  loadScript('js/mi-ruta.js')
    .then(() => loadScript('js/rutas-oficiales.js'))
    .catch(console.error);
})();
