/* Visita Loja — carga segura de validación de visitas y QR sin encargado. */
(() => {
  'use strict';
  if (window.__visitaLojaSelfCheckinBootstrap) return;
  window.__visitaLojaSelfCheckinBootstrap = true;

  const scripts = [
    'js/admin-visit-validation-mode.js',
    'js/admin-visit-validation-mode-integration.js',
    'js/admin-self-checkin-qr.js',
    'js/admin-self-checkin-qr-ui.js'
  ];

  function load(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing?.dataset.loaded === 'true') return resolve();
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.append(script);
    });
  }

  async function boot() {
    try {
      for (const src of scripts) await load(src);
      const originalEdit = window.editAdminPlace;
      if (typeof originalEdit === 'function' && !originalEdit.__selfCheckinWrapped) {
        const wrapped = function (...args) {
          const result = originalEdit.apply(this, args);
          const id = String(args[0] || '').trim();
          const place = Array.isArray(window.adminPlaces)
            ? window.adminPlaces.find(item => String(item?.id || '') === id)
            : null;
          queueMicrotask(() => window.VisitaLojaSelfCheckinQrUi?.setPlace(place || { id }));
          return result;
        };
        wrapped.__selfCheckinWrapped = true;
        window.editAdminPlace = wrapped;
      }

      const form = document.getElementById('placeForm');
      form?.addEventListener('reset', () => queueMicrotask(() => window.VisitaLojaSelfCheckinQrUi?.clearPlace()));
      document.getElementById('newPlaceBtn')?.addEventListener('click', () => window.VisitaLojaSelfCheckinQrUi?.clearPlace());
      window.VisitaLojaSelfCheckinQrUi?.renderMode();
    } catch (error) {
      console.warn('Self-check-in Admin no pudo inicializarse:', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
