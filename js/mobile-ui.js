/* Visita Loja — comportamiento móvil. */
(function () {
  'use strict';

  function isEnglish() {
    return typeof currentLang !== 'undefined' && currentLang === 'en';
  }

  function updateMobileAccessibility() {
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const menuButton = document.getElementById('mobileMenuButton');
    if (!menuButton) return;
    menuButton.setAttribute('aria-label', isEnglish() ? 'Open menu' : 'Abrir menú');
  }

  function initMobileUi() {
    if (!window.matchMedia('(max-width: 767px)').matches) return;

    // En móvil Chabaquito inicia compacto; el comportamiento existente puede
    // seguir abriendo/cerrando su mensaje cuando el visitante lo solicite.
    const bubble = document.getElementById('webMascotBubble');
    if (bubble) bubble.classList.add('is-quiet');

    updateMobileAccessibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileUi, { once: true });
  } else {
    initMobileUi();
  }

  window.addEventListener('languagechange', updateMobileAccessibility);
})();
