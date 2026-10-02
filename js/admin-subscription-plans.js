(function (global) {
  'use strict';

  const api = global.VisitaLojaSubscriptionPlans;
  if (!api) {
    console.warn('[VisitaLoja] subscription-plan-config.js debe cargarse antes de admin-subscription-plans.js');
    return;
  }

  let settingsCache = null;

  function db() {
    if (!global.firebase || !firebase.firestore) throw new Error('Firestore no está disponible.');
    return firebase.firestore();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value == null ? null : value));
  }

  async function load() {
    settingsCache = await api.loadPlanSettings(db());
    return clone(settingsCache);
  }

  function current() {
    return clone(settingsCache || { plans: [] });
  }

  function cleanPlanForSave(plan, index) {
    const normalized = api.normalizePlans([plan])[0];
    const rawMonthly = Number(plan && plan.monthly);
    const rawAnnual = Number(plan && plan.annual);
    return {
      ...plan,
      id: normalized.id,
      name: normalized.name,
      active: normalized.active,
      ...(Number.isFinite(rawMonthly) ? { monthly: rawMonthly } : {}),
      ...(Number.isFinite(rawAnnual) ? { annual: rawAnnual } : {}),
      features: {
        ...((plan && plan.features) || {}),
        maxGalleryImages: normalized.features.maxGalleryImages
      },
      sortOrder: Number.isFinite(Number(plan && plan.sortOrder)) ? Number(plan.sortOrder) : index
    };
  }

  function validatePlans(plans) {
    if (!Array.isArray(plans)) throw new Error('La configuración de planes no es válida.');
    const ids = new Set();
    plans.forEach((plan, index) => {
      const cleaned = cleanPlanForSave(plan, index);
      const key = String(cleaned.id).trim().toLowerCase();
      if (!key) throw new Error('Cada plan necesita un identificador.');
      if (ids.has(key)) throw new Error('Hay identificadores de plan repetidos: ' + cleaned.id);
      ids.add(key);
      const limit = cleaned.features.maxGalleryImages;
      if (!Number.isInteger(limit) || limit < api.MIN_GALLERY_LIMIT || limit > api.MAX_GALLERY_LIMIT) {
        throw new Error('El límite de galería debe estar entre ' + api.MIN_GALLERY_LIMIT + ' y ' + api.MAX_GALLERY_LIMIT + '.');
      }
    });
    return true;
  }

  async function savePlans(plans, options) {
    validatePlans(plans);
    const cleanedPlans = plans.map(cleanPlanForSave);
    const payload = {
      plans: cleanedPlans,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const user = firebase.auth && firebase.auth().currentUser;
    if (user && user.email) payload.updatedBy = user.email;
    if (options && options.note) payload.updateNote = String(options.note).slice(0, 240);

    await db().collection(api.SETTINGS_COLLECTION).doc(api.SETTINGS_DOCUMENT).set(payload, { merge: true });
    settingsCache = { ...(settingsCache || {}), ...payload, plans: api.normalizePlans(cleanedPlans) };
    return current();
  }

  function newPlan(seed) {
    const source = seed && typeof seed === 'object' ? seed : {};
    return {
      id: source.id || '',
      name: source.name || '',
      active: source.active !== false,
      monthly: source.monthly == null ? '' : source.monthly,
      annual: source.annual == null ? '' : source.annual,
      features: {
        ...(source.features || {}),
        maxGalleryImages: Number.isFinite(Number(source.features && source.features.maxGalleryImages))
          ? Number(source.features.maxGalleryImages)
          : api.DEFAULT_GALLERY_LIMIT
      }
    };
  }

  global.VisitaLojaAdminSubscriptionPlans = Object.freeze({
    load,
    current,
    savePlans,
    validatePlans,
    newPlan
  });
})(window);
