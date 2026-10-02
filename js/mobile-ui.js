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
    if (source) new MutationObserver(syncQuickRouteBadge).observe(source, { childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['class'] });
  }

  function findDesktopNav() {
    return Array.from(document.querySelectorAll('nav div')).find((node) => node.classList.contains('2xl:flex') && node.classList.contains('flex-1')) || null;
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
    const mesaLink = document.createElement('a');
    mesaLink.id = 'desktopMesaTuristicaLink';
    mesaLink.href = 'mesa-turistica.html';
    mesaLink.className = 'vl-explore-item flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 hover:text-brandGold transition';
    mesaLink.innerHTML = '<i class="fa-solid fa-people-group text-brandGold w-4"></i><span>Mesa Turística</span>';
    mesaLink.addEventListener('click', () => { details.open = false; });
    panel.appendChild(mesaLink);
    const alliesLink = document.createElement('a');
    alliesLink.id = 'desktopAlliesLink';
    alliesLink.href = 'aliados.html';
    alliesLink.className = 'vl-explore-item flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 hover:text-brandGold transition';
    alliesLink.innerHTML = '<i class="fa-solid fa-handshake text-brandGold w-4"></i><span>Aliados</span>';
    alliesLink.addEventListener('click', () => { details.open = false; });
    panel.appendChild(alliesLink);
    desktopNav.insertBefore(details, candidates[0]);
    document.addEventListener('click', (event) => { if (details.open && !details.contains(event.target)) details.open = false; });
  }

  function updateResponsiveLabels() {
    const menuButton = document.getElementById('mobileMenuButton');
    if (menuButton) menuButton.setAttribute('aria-label', isEnglish() ? 'Open menu' : 'Abrir menú');
    const quickLabel = document.querySelector('.vl-mobile-route-label');
    if (quickLabel) quickLabel.textContent = isEnglish() ? 'My Route' : 'Mi Ruta';
    const exploreLabel = document.querySelector('#desktopExploreMenu summary span');
    if (exploreLabel) exploreLabel.textContent = isEnglish() ? 'Explore' : 'Explorar';
    const mesaLabel = document.querySelector('#desktopMesaTuristicaLink span');
    if (mesaLabel) mesaLabel.textContent = isEnglish() ? 'Tourism Board' : 'Mesa Turística';
    const alliesLabel = document.querySelector('#desktopAlliesLink span');
    if (alliesLabel) alliesLabel.textContent = isEnglish() ? 'Allies' : 'Aliados';
    const sponsorCtaLabel = document.getElementById('principalSponsorsCtaLabel');
    if (sponsorCtaLabel) sponsorCtaLabel.textContent = isEnglish() ? 'Meet our allies' : 'Conoce a nuestros aliados';
  }

  function renderMesaTuristicaSpotlight() {
    if (document.getElementById('mesaTuristicaSpotlight')) return;
    const sponsors = document.getElementById('patrocinadores');
    if (!sponsors?.parentElement) return;
    const section = document.createElement('section');
    section.id = 'mesaTuristicaSpotlight';
    section.className = 'relative overflow-hidden py-16 sm:py-20 px-4 md:px-8 bg-[#071713] text-white border-t border-white/10';
    section.innerHTML = `
      <div class="absolute -top-28 -left-20 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-32 right-0 w-96 h-96 rounded-full bg-brandGold/10 blur-3xl pointer-events-none"></div>
      <div class="relative max-w-6xl mx-auto grid lg:grid-cols-[.9fr_1.1fr] gap-8 lg:gap-12 items-center">
        <div class="rounded-[2rem] border border-white/10 bg-black/25 p-7 sm:p-10 min-h-[280px] flex items-center justify-center shadow-2xl">
          <img src="logo%20mesa%20turistica.webp" alt="Logo oficial de la Mesa Turística de Loja" class="w-full max-w-[430px] h-auto object-contain" loading="lazy" decoding="async">
        </div>
        <div>
          <div class="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-[.2em] text-cyan-200"><i class="fa-solid fa-handshake-angle"></i> Institución de apoyo</div>
          <h2 class="text-3xl sm:text-5xl font-black leading-tight mt-5">Mesa Turística <span class="text-brandGold">de Loja</span></h2>
          <p class="mt-5 text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl">Un actor fundamental que articula esfuerzos del sector turístico y acompaña iniciativas para fortalecer la promoción, identidad y desarrollo de Loja como destino.</p>
          <div class="mt-7 rounded-2xl border border-white/10 bg-white/5 p-5 flex gap-4 items-start">
            <span class="w-11 h-11 rounded-xl bg-brandGold/15 text-brandGold flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-people-group"></i></span>
            <p class="text-sm text-gray-300 leading-relaxed"><strong class="text-white">VisitaLoja.com + Mesa Turística de Loja</strong><br>Articulación y tecnología trabajando para conectar visitantes, emprendimientos, cultura, gastronomía y experiencias de nuestra provincia.</p>
          </div>
          <a href="mesa-turistica.html" class="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-brandGold px-6 py-3.5 text-sm font-black text-white shadow-warm-glow hover:bg-brandGoldHover transition">Conocer la Mesa Turística <i class="fa-solid fa-arrow-right"></i></a>
        </div>
      </div>`;
    sponsors.parentElement.insertBefore(section, sponsors);
  }

  function renderPrincipalSponsors() {
    const marker = document.getElementById('institutionalSupportTitle');
    const section = document.getElementById('patrocinadores') || marker?.closest('section');
    if (!section || section.dataset.principalSponsors === '1') return;
    section.dataset.principalSponsors = '1';
    section.id = 'patrocinadores';
    section.className = 'py-16 px-4 md:px-8 bg-[#181818] text-white border-t border-brandGold/20 text-center';
    section.innerHTML = `
      <div class="max-w-6xl mx-auto">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brandGold/10 border border-brandGold/30 text-brandGold text-2xl mb-4 shadow-warm-glow"><i class="fa-solid fa-handshake"></i></div>
        <p class="text-[10px] sm:text-xs font-black uppercase tracking-[.28em] text-gray-400 mb-2">Aliados principales de VisitaLoja</p>
        <h3 class="text-3xl sm:text-4xl font-black text-white mb-4">Juntos <span class="text-brandGold">impulsamos Loja</span></h3>
        <p class="text-sm sm:text-base text-gray-300 max-w-3xl mx-auto leading-relaxed">VisitaLoja conecta turismo, cultura, gastronomía y comercio con el apoyo de empresas comprometidas con el desarrollo de nuestra provincia.</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10 text-left">
          <article class="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col"><div class="h-36 flex items-center justify-center px-7 py-5 border-b border-gray-100"><img src="banco-de-loja.png" alt="Banco de Loja" class="max-h-24 max-w-[82%] object-contain" loading="lazy"></div><div class="p-6 flex-1"><p class="text-[10px] font-black uppercase tracking-[.18em] text-brandGold mb-2">Aliado financiero</p><h4 class="text-xl font-black text-gray-900 mb-2">Banco de Loja</h4><p class="text-sm leading-relaxed text-gray-600">Impulsando el desarrollo y los emprendimientos de nuestra provincia.</p></div></article>
          <article class="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col"><div class="h-36 flex items-center justify-center px-7 py-5 border-b border-gray-100"><img src="netplus.png" alt="NettPlus" class="max-h-24 max-w-[82%] object-contain" loading="lazy"></div><div class="p-6 flex-1"><p class="text-[10px] font-black uppercase tracking-[.18em] text-brandGold mb-2">Aliado de conectividad</p><h4 class="text-xl font-black text-gray-900 mb-2">NettPlus</h4><p class="text-sm leading-relaxed text-gray-600">Conectando tu recorrido por Loja.</p></div></article>
          <article class="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col"><div class="h-36 flex items-center justify-center px-7 py-5 border-b border-gray-100"><img src="ile.png" alt="ILE - Industria Lojana de Especerías" class="max-h-24 max-w-[82%] object-contain" loading="lazy"></div><div class="p-6 flex-1"><p class="text-[10px] font-black uppercase tracking-[.18em] text-brandGold mb-2">Aliado de identidad, gastronomía y producción lojana</p><h4 class="text-xl font-black text-gray-900 mb-2">ILE</h4><p class="text-sm leading-relaxed text-gray-600">Celebrando los sabores y la identidad de nuestra tierra.</p></div></article>
        </div>
        <div class="mt-8 flex flex-col items-center gap-5">
          <span class="bg-black/50 px-5 py-3 rounded-xl border border-gray-800 text-xs font-bold text-gray-400 uppercase tracking-widest"><i class="fa-solid fa-certificate text-brandGold mr-1.5"></i>Respaldo institucional: <span>Mesa Turística de Loja</span></span>
          <a href="aliados.html" class="inline-flex items-center justify-center gap-2 rounded-xl bg-brandGold px-6 py-3 text-sm font-black text-white shadow-warm-glow hover:bg-brandGoldHover transition"><span id="principalSponsorsCtaLabel">Conoce a nuestros aliados</span><i class="fa-solid fa-arrow-right"></i></a>
        </div>
      </div>`;
  }

  function loadSponsorExperiences() {
    if (window.VisitaLojaSponsors?.renderSponsoredExperiences) {
      window.VisitaLojaSponsors.renderSponsoredExperiences();
      return;
    }
    if (document.getElementById('visitaLojaSponsorsScript')) return;
    const script = document.createElement('script');
    script.id = 'visitaLojaSponsorsScript';
    script.src = 'js/sponsors.js';
    script.defer = true;
    script.addEventListener('load', () => window.VisitaLojaSponsors?.renderSponsoredExperiences?.());
    document.body.appendChild(script);
  }

  function improveLojaTimeSelector() {
    const container = document.getElementById('lojaTimeTabsContainer');
    if (!container) return;

    if (!document.getElementById('vlLojaTimeSelectorStyles')) {
      const style = document.createElement('style');
      style.id = 'vlLojaTimeSelectorStyles';
      style.textContent = `
        #lojaTimeTabsContainer.vl-time-selector { display:grid!important;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));width:min(100%,720px);margin:1.5rem auto 0;gap:.65rem!important;overflow:visible!important;padding:.35rem!important;border:1px solid rgba(255,255,255,.08);border-radius:1rem;background:rgba(0,0,0,.22); }
        #lojaTimeTabsContainer.vl-time-selector > button { width:100%;min-width:0;min-height:46px;padding:.7rem 1rem!important;border-radius:.75rem!important;justify-content:center;white-space:normal!important;text-align:center;line-height:1.2;gap:.5rem!important;border-color:rgba(255,255,255,.14)!important;background:rgba(255,255,255,.045)!important;color:#e5e7eb!important;box-shadow:none!important; }
        #lojaTimeTabsContainer.vl-time-selector > button:hover { border-color:rgba(234,88,12,.65)!important;background:rgba(234,88,12,.09)!important; }
        #lojaTimeTabsContainer.vl-time-selector > button.vl-time-active { border-color:#EA580C!important;background:#EA580C!important;color:#fff!important;box-shadow:0 8px 22px rgba(234,88,12,.2)!important; }
        #lojaTimeTabsContainer.vl-time-selector > button i { flex:0 0 auto;color:#EA580C!important; }
        #lojaTimeTabsContainer.vl-time-selector > button.vl-time-active i { color:#fff!important; }
        @media (max-width:639px) { #lojaTimeTabsContainer.vl-time-selector { grid-template-columns:1fr;width:100%;max-width:420px;gap:.5rem!important;margin-top:1.1rem;padding:.3rem!important; } #lojaTimeTabsContainer.vl-time-selector > button { min-height:48px;font-size:.78rem!important;padding:.75rem .85rem!important; } }
      `;
      document.head.appendChild(style);
    }

    const sync = () => {
      container.classList.add('vl-time-selector');
      Array.from(container.querySelectorAll(':scope > button')).forEach((button) => {
        const active = button.classList.contains('bg-brandGold');
        button.classList.toggle('vl-time-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };

    sync();
    new MutationObserver(sync).observe(container, { childList: true });
  }

  function initResponsiveNavigation() {
    createMobileQuickRoute();
    createDesktopExploreMenu();
    renderMesaTuristicaSpotlight();
    renderPrincipalSponsors();
    loadSponsorExperiences();
    improveLojaTimeSelector();
    if (window.matchMedia('(max-width: 767px)').matches) {
      const bubble = document.getElementById('webMascotBubble');
      if (bubble) bubble.classList.add('is-quiet');
    }
    updateResponsiveLabels();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initResponsiveNavigation, { once: true });
  else initResponsiveNavigation();
  window.addEventListener('languagechange', updateResponsiveLabels);
})();
