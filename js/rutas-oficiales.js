/* Visita Loja — rutas oficiales publicadas. */
(function () {
  'use strict';

  const COLLECTION = 'touristRoutes';
  let publishedRoutes = [];

  function getDb() {
    if (typeof db !== 'undefined' && db) return db;
    if (window.firebase && firebase.firestore) return firebase.firestore();
    throw new Error('Firestore no está disponible.');
  }

  function escapeHtml(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(String(value || ''));
    return String(value || '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  }

  function safeImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function normalizeStops(stops) {
    if (!Array.isArray(stops)) return [];
    return stops.map((stop, index) => typeof stop === 'string'
      ? { id: stop, order: index }
      : { id: String(stop?.id || ''), order: Number(stop?.order ?? index) })
      .filter((stop) => stop.id)
      .sort((a, b) => a.order - b.order);
  }

  function normalizeRoute(doc) {
    const data = doc.data() || {};
    return {
      id: doc.id,
      name: String(data.name || '').trim(),
      description: String(data.description || '').trim(),
      duration: String(data.duration || '').trim(),
      image: safeImageUrl(data.image),
      status: data.status === 'published' ? 'published' : 'draft',
      stops: normalizeStops(data.stops)
    };
  }

  function officialRoutesMarkup() {
    if (!publishedRoutes.length) return '';
    return `<section id="officialRoutesPanel" class="mb-4 rounded-2xl border border-brandGold/30 bg-orange-50/60 p-3">
      <div class="flex items-center gap-2 mb-3">
        <span class="w-9 h-9 rounded-xl bg-brandGold text-white grid place-items-center"><i class="fa-solid fa-map-location-dot"></i></span>
        <div><p class="text-[10px] uppercase tracking-[.18em] text-brandGold font-black">Recomendadas</p><h4 class="font-black text-brandDark text-sm">Rutas oficiales</h4></div>
      </div>
      <div class="space-y-2">${publishedRoutes.map((route) => `<article class="bg-white border border-orange-100 rounded-xl p-3 shadow-sm">
        <div class="flex gap-3">
          ${route.image ? `<img src="${escapeHtml(route.image)}" alt="Portada de ${escapeHtml(route.name || 'ruta oficial')}" class="w-16 h-16 rounded-xl object-cover flex-shrink-0" loading="lazy" decoding="async" onerror="this.style.display='none'">` : `<div class="w-16 h-16 rounded-xl bg-brandDark text-brandGold grid place-items-center flex-shrink-0"><i class="fa-solid fa-route text-xl"></i></div>`}
          <div class="min-w-0 flex-1"><h5 class="font-black text-brandDark text-sm">${escapeHtml(route.name || 'Ruta oficial')}</h5><p class="text-[11px] text-gray-500 mt-1 line-clamp-2">${escapeHtml(route.description || '')}</p><div class="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] font-bold text-gray-500">${route.duration ? `<span><i class="fa-regular fa-clock mr-1 text-brandGold"></i>${escapeHtml(route.duration)}</span>` : ''}<span><i class="fa-solid fa-location-dot mr-1 text-brandGold"></i>${route.stops.length} parada${route.stops.length === 1 ? '' : 's'}</span></div></div>
        </div>
        <button type="button" data-use-official-route="${escapeHtml(route.id)}" class="mt-3 w-full rounded-xl bg-brandDark text-white py-2.5 text-xs font-black hover:bg-black transition"><i class="fa-solid fa-route mr-2 text-brandGold"></i>Usar esta ruta</button>
      </article>`).join('')}</div>
    </section>`;
  }

  function renderOfficialRoutes() {
    const itinerary = document.getElementById('itineraryListContainer');
    if (!itinerary) return false;
    document.getElementById('officialRoutesPanel')?.remove();
    const markup = officialRoutesMarkup();
    if (markup) itinerary.insertAdjacentHTML('beforebegin', markup);
    return true;
  }

  function useOfficialRoute(routeId) {
    const route = publishedRoutes.find((item) => item.id === String(routeId || ''));
    if (!route) return;
    if (!Array.isArray(window.locations) && typeof locations === 'undefined') {
      if (typeof showToast === 'function') showToast('No se pudieron cargar las paradas de esta ruta.');
      return;
    }
    const available = typeof locations !== 'undefined' ? locations : window.locations;
    const validIds = route.stops.map((stop) => stop.id).filter((id) => available.some((loc) => String(loc.id) === String(id)));
    if (!validIds.length) {
      if (typeof showToast === 'function') showToast('Esta ruta no tiene paradas disponibles actualmente.');
      return;
    }
    favoriteLocations.splice(0, favoriteLocations.length, ...validIds);
    if (typeof activeItineraryIndex !== 'undefined') activeItineraryIndex = 0;
    if (typeof itineraryJourneyActive !== 'undefined') itineraryJourneyActive = false;
    if (typeof persistFavorites === 'function') persistFavorites();
    if (typeof saveItineraryJourneyState === 'function') saveItineraryJourneyState();
    if (typeof updateItineraryUI === 'function') updateItineraryUI();
    renderOfficialRoutes();
    const skipped = route.stops.length - validIds.length;
    const suffix = skipped > 0 ? ` ${skipped} parada${skipped === 1 ? '' : 's'} no disponible${skipped === 1 ? '' : 's'} fue${skipped === 1 ? '' : 'ron'} omitida${skipped === 1 ? '' : 's'}.` : '';
    if (typeof showToast === 'function') showToast(`Ruta “${route.name || 'oficial'}” agregada a Mi Ruta.${suffix}`);
  }

  async function loadPublishedRoutes() {
    const snapshot = await getDb().collection(COLLECTION).where('status', '==', 'published').get();
    publishedRoutes = snapshot.docs.map(normalizeRoute).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    renderOfficialRoutes();
    window.dispatchEvent(new CustomEvent('visitaloja:official-routes-loaded', { detail: publishedRoutes.slice() }));
    return publishedRoutes.slice();
  }

  function getPublishedRoutes() { return publishedRoutes.slice(); }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-use-official-route]');
    if (button) useOfficialRoute(button.dataset.useOfficialRoute);
  });

  window.VisitaLojaOfficialRoutes = Object.freeze({ load: loadPublishedRoutes, getAll: getPublishedRoutes, render: renderOfficialRoutes, use: useOfficialRoute });

  loadPublishedRoutes().catch((error) => console.error('No se pudieron cargar las rutas oficiales publicadas:', error));
})();
