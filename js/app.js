/* Visita Loja — cargador incremental de módulos.
 * Permite migrar funcionalidades fuera de index.html sin rehacer la web de golpe.
 */
(function () {
  'use strict';

  const PRODUCTION_URL = 'https://www.visitaloja.com/';

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

  // Corrige referencias heredadas del dominio provisional sin alterar el deploy de pruebas.
  function normalizeProductionSeo() {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = PRODUCTION_URL;

    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      const raw = script.textContent || '';
      if (!raw.includes('visita-loja.vercel.app')) return;
      try {
        const data = JSON.parse(raw);
        const replaceDomain = (value) => {
          if (typeof value === 'string') {
            return value.replace(/https:\/\/visita-loja\.vercel\.app\//g, PRODUCTION_URL);
          }
          if (Array.isArray(value)) return value.map(replaceDomain);
          if (value && typeof value === 'object') {
            Object.keys(value).forEach((key) => { value[key] = replaceDomain(value[key]); });
          }
          return value;
        };
        script.textContent = JSON.stringify(replaceDomain(data));
      } catch (error) {
        console.warn('No se pudo normalizar un bloque SEO de Visita Loja.', error);
      }
    });
  }

  // Este bloque inferior quedó duplicado: las redes oficiales ya están en la zona superior.
  function removeLegacyContactBlock() {
    document.querySelector('section[aria-label="Contacto de Visita Loja"]')?.remove();
  }

  normalizeProductionSeo();

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
