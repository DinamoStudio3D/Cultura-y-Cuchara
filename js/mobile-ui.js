/* Visita Loja — comportamiento móvil
 * Extracción incremental preparada en rama de refactor.
 * Todavía no se carga desde index.html.
 */

(function () {
  'use strict';

  function initMobileUi() {
    if (!window.matchMedia('(max-width: 767px)').matches) return;

    // En móvil Chabaquito inicia compacto; el comportamiento existente puede
    // seguir abriendo/cerrando su mensaje cuando el visitante lo solicite.
    const bubble = document.getElementById('webMascotBubble');
    if (bubble) bubble.classList.add('is-quiet');

    // Mantiene accesible el menú hamburguesa sin crear nuevos flotantes.
    const menuButton = document.getElementById('mobileMenuButton');
    if (menuButton) menuButton.setAttribute('aria-label', menuButton.getAttribute('aria-label') || 'Abrir menú');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileUi, { once: true });
  } else {
    initMobileUi();
  }
})();
