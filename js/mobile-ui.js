/* Visita Loja — navegación y comportamiento responsive.
 * Capa incremental: reorganiza accesos sin modificar la lógica principal de index.html.
 */
(function () {
  'use strict';

  function isEnglish() {
    return typeof currentLang !== 'undefined' && currentLang === 'en';
  }

  function openItinerary() {
    if (typeof window.openModal === 'function') window.openModal('itineraryModal');
  }

  function syncQuickRouteBadge() {
    const source = document.getElementById('itineraryBadge');
    const target = document.getElementById('mobileQuickRouteBadge');
    if (!source || !target) return;
    const count = Number.parseInt((source.textContent || '0').trim(), 10) || 0;
    target.textContent = String(count);
    target.classList.toggle('hidden', count < 1);
    target.classList.toggle('inline-flex', count > 0);
  }

  function createMobileQuickRoute() {
    if (document.getElementById('mobileQuickRouteButton')) return;
    const menuButton = document.getElementById('mobileMenuButton');
    if (!menuButton?.parentElement) return;

    const actions = document.createElement('div');
    actions.className = 'vl-mobile-nav-actions 2xl:hidden flex items-center gap-2 ml-auto';

    const routeButton = document.createElement('button');
    routeButton.id = 'mobileQuickRouteButton';
    routeButton.type = 'button';
    routeButton.className = 'vl-mobile-route-quick relative inline-flex items-center gap-1.5 rounded-xl border border-brandGold/60 bg-brandGold/15 text-brandGold font-black px-3 py-2 text-xs shadow-warm-glow';
    routeButton.innerHTML = '<i class="fa-solid fa-route" aria-hidden="true"></i><span class="vl-mobile-route-label">Mi Ruta</span><span id="mobileQuickRouteBadge" class="hidden min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black items-center justify-center">0</span>';
    routeButton.addEventListener('click', openItinerary);

    menuButton.parentElement.insertBefore(actions, menuButton);
    actions.append(routeButton, menuButton);

    const legacyRouteButton = document.getElementById('mobileItineraryButton');
    if (legacyRouteButton) legacyRouteButton.classList.add('vl-route-menu-duplicate');

    syncQuickRouteBadge();
    const source = document.getElementById('itineraryBadge');
    if (source) {
      new MutationObserver(syncQuickRouteBadge).observe(source, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  function findDesktopNav() {
    return Array.from(document.querySelectorAll('nav div')).find((node) =>
      node.classList.contains('2xl:flex') && node.classList.contains('flex-1')
    ) || null;
  }

  function createDesktopExploreMenu() {
    if (document.getElementById('desktopExploreMenu')) return;
    const desktopNav = findDesktopNav();
    if (!desktopNav) return;

    const candidates = Array.from(desktopNav.children).filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.matches('#accountNavButton, #langSelector, #lowDataToggleDesktop')) return false;
      if (node.matches('button[onclick*="itineraryModal"]')) return false;
      if (node.matches('a[href="#inicio"], a[href="#tendencia"], a[href="#mapa"], a[href="#establecimientos"]')) return false;
      return node.matches('a');
    });
    if (!candidates.length) return;

    const details = document.createElement('details');
    details.id = 'desktopExploreMenu';
    details.className = 'vl-desktop-explore relative';
    details.innerHTML = '<summary class="cursor-pointer list-none inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-gray-200 hover:text-brandGold hover:border-brandGold/50 transition"><i class="fa-solid fa-compass text-brandGold"></i><span>Explorar</span><i class="fa-solid fa-chevron-down text-[9px]"></i></summary><div class="vl-desktop-explore-panel absolute right-0 top-full mt-2 w-72 rounded-2xl border border-white/10 bg-[#151515]/[.98] p-2 shadow-2xl backdrop-blur-xl z-[80]"></div>';
    const panel = details.querySelector('.vl-desktop-explore-panel');

    candidates.forEach((original) => {
      const clone = original.cloneNode(true);
      clone.removeAttribute('id');
      clone.className = 'vl-explore-item flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 hover:text-brandGold transition';
      clone.addEventListener('click', () => { details.open = false; });
      panel.appendChild(clone);
      original.classList.add('vl-desktop-secondary-original');
    });

    desktopNav.insertBefore(details, candidates[0]);

    document.addEventListener('click', (event) => {
      if (details.open && !details.contains(event.target)) details.open = false;
    });
  }

  function updateResponsiveLabels() {
    const menuButton = document.getElementById('mobileMenuButton');
    if (menuButton) menuButton.setAttribute('aria-label', isEnglish() ? 'Open menu' : 'Abrir menú');
    const quickLabel = document.querySelector('.vl-mobile-route-label');
    if (quickLabel) quickLabel.textContent = isEnglish() ? 'My Route' : 'Mi Ruta';
    const exploreLabel = document.querySelector('#desktopExploreMenu summary span');
    if (exploreLabel) exploreLabel.textContent = isEnglish() ? 'Explore' : 'Explorar';
  }

  function initResponsiveNavigation() {
    createMobileQuickRoute();
    createDesktopExploreMenu();

    if (window.matchMedia('(max-width: 767px)').matches) {
      const bubble = document.getElementById('webMascotBubble');
      if (bubble) bubble.classList.add('is-quiet');
    }

    updateResponsiveLabels();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initResponsiveNavigation, { once: true });
  } else {
    initResponsiveNavigation();
  }

  window.addEventListener('languagechange', updateResponsiveLabels);
})();
