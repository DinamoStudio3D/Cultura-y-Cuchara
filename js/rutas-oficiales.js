/* Visita Loja — rutas oficiales publicadas.
 * Primera integración pública: solo lectura. No modifica Mi Ruta todavía.
 */
(function () {
  'use strict';

  const COLLECTION = 'touristRoutes';
  let publishedRoutes = [];

  function getDb() {
    if (typeof db !== 'undefined' && db) return db;
    if (window.firebase && firebase.firestore) return firebase.firestore();
    throw new Error('Firestore no está disponible.');
  }

  function normalizeStops(stops) {
    if (!Array.isArray(stops)) return [];
    return stops
      .map((stop, index) => typeof stop === 'string' ? { id: stop, order: index } : { id: String(stop?.id || ''), order: Number(stop?.order ?? index) })
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
      image: String(data.image || '').trim(),
      status: data.status === 'published' ? 'published' : 'draft',
      stops: normalizeStops(data.stops)
    };
  }

  async function loadPublishedRoutes() {
    const snapshot = await getDb().collection(COLLECTION).where('status', '==', 'published').get();
    publishedRoutes = snapshot.docs.map(normalizeRoute).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    window.dispatchEvent(new CustomEvent('visitaloja:official-routes-loaded', { detail: publishedRoutes.slice() }));
    return publishedRoutes.slice();
  }

  function getPublishedRoutes() {
    return publishedRoutes.slice();
  }

  window.VisitaLojaOfficialRoutes = Object.freeze({
    load: loadPublishedRoutes,
    getAll: getPublishedRoutes
  });

  loadPublishedRoutes().catch((error) => console.error('No se pudieron cargar las rutas oficiales publicadas:', error));
})();
