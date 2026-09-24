/* Visita Loja — administración de rutas turísticas
 * Módulo aislado para touristRoutes. Se conectará a admin.html después de validar esta base.
 */
(function () {
  'use strict';

  const COLLECTION = 'touristRoutes';
  let touristRoutes = [];

  function getDb() {
    if (typeof db !== 'undefined' && db) return db;
    if (window.firebase && firebase.firestore) return firebase.firestore();
    throw new Error('Firestore no está disponible.');
  }

  function cleanText(value, maxLength) {
    return String(value || '').trim().slice(0, maxLength);
  }

  function normalizeStops(stops) {
    if (!Array.isArray(stops)) return [];
    const seen = new Set();
    return stops
      .map((stop) => typeof stop === 'string' ? stop : stop && stop.id)
      .map((id) => String(id || '').trim())
      .filter((id) => id && !seen.has(id) && seen.add(id))
      .map((id, index) => ({ id, order: index }));
  }

  function normalizeRoute(input) {
    const route = input || {};
    const status = route.status === 'published' ? 'published' : 'draft';
    return {
      name: cleanText(route.name, 120),
      description: cleanText(route.description, 1200),
      duration: cleanText(route.duration, 80),
      image: cleanText(route.image, 1000),
      status,
      stops: normalizeStops(route.stops)
    };
  }

  function validateRoute(route) {
    if (!route.name) throw new Error('La ruta necesita un nombre.');
    if (!route.description) throw new Error('La ruta necesita una descripción.');
    if (!route.stops.length) throw new Error('Agrega al menos una parada a la ruta.');
    return route;
  }

  async function loadTouristRoutes() {
    const snapshot = await getDb().collection(COLLECTION).get();
    touristRoutes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    touristRoutes.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
    return touristRoutes.slice();
  }

  async function saveTouristRoute(routeId, input) {
    const route = validateRoute(normalizeRoute(input));
    const payload = {
      ...route,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (routeId) {
      await getDb().collection(COLLECTION).doc(String(routeId)).set(payload, { merge: true });
      return String(routeId);
    }

    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    const doc = await getDb().collection(COLLECTION).add(payload);
    return doc.id;
  }

  async function deleteTouristRoute(routeId) {
    if (!routeId) throw new Error('Ruta no válida.');
    await getDb().collection(COLLECTION).doc(String(routeId)).delete();
  }

  async function setTouristRouteStatus(routeId, status) {
    if (!routeId) throw new Error('Ruta no válida.');
    const nextStatus = status === 'published' ? 'published' : 'draft';
    await getDb().collection(COLLECTION).doc(String(routeId)).update({
      status: nextStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  window.VisitaLojaAdminRoutes = Object.freeze({
    load: loadTouristRoutes,
    save: saveTouristRoute,
    remove: deleteTouristRoute,
    setStatus: setTouristRouteStatus,
    normalize: normalizeRoute
  });
})();
