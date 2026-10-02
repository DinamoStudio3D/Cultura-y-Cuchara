(function (global) {
  'use strict';

  const SETTINGS_COLLECTION = 'settings';
  const SETTINGS_DOCUMENT = 'subscriptions';
  const DEFAULT_GALLERY_LIMIT = 6;
  const MIN_GALLERY_LIMIT = 0;
  const MAX_GALLERY_LIMIT = 100;

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizePlanId(value) {
    return cleanText(value).toLowerCase();
  }

  function normalizeGalleryLimit(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(MAX_GALLERY_LIMIT, Math.max(MIN_GALLERY_LIMIT, parsed));
  }

  function normalizePlan(plan, index) {
    const source = plan && typeof plan === 'object' ? plan : {};
    const features = source.features && typeof source.features === 'object' ? source.features : {};
    const id = cleanText(source.id || source.key || source.slug || source.code || source.name) || ('plan-' + (index + 1));
    return {
      ...source,
      id,
      name: cleanText(source.name || source.title || source.label) || id,
      active: source.active !== false,
      features: {
        ...features,
        maxGalleryImages: normalizeGalleryLimit(
          features.maxGalleryImages != null ? features.maxGalleryImages : source.maxGalleryImages,
          DEFAULT_GALLERY_LIMIT
        )
      }
    };
  }

  function normalizePlans(plans) {
    return Array.isArray(plans) ? plans.map(normalizePlan) : [];
  }

  async function loadPlanSettings(db) {
    if (!db || typeof db.collection !== 'function') throw new Error('Firestore no está disponible.');
    const snapshot = await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOCUMENT).get();
    const data = snapshot.exists ? (snapshot.data() || {}) : {};
    return {
      ...data,
      plans: normalizePlans(data.plans)
    };
  }

  function findPlan(settings, planId) {
    const wanted = normalizePlanId(planId);
    if (!wanted) return null;
    const plans = settings && Array.isArray(settings.plans) ? settings.plans : [];
    return plans.find((plan) => {
      const candidates = [plan.id, plan.key, plan.slug, plan.code, plan.name];
      return candidates.some((value) => normalizePlanId(value) === wanted);
    }) || null;
  }

  function subscriptionPlanId(place) {
    const subscription = place && place.subscription && typeof place.subscription === 'object' ? place.subscription : {};
    return cleanText(subscription.plan || subscription.planId || subscription.id);
  }

  function capabilitiesForPlace(place, settings) {
    const planId = subscriptionPlanId(place);
    const plan = findPlan(settings, planId);
    const features = plan && plan.features ? plan.features : {};
    return {
      planId,
      plan,
      maxGalleryImages: normalizeGalleryLimit(features.maxGalleryImages, DEFAULT_GALLERY_LIMIT),
      usesConfiguredPlan: Boolean(plan)
    };
  }

  function validateGalleryCount(gallery, capabilities) {
    const count = Array.isArray(gallery) ? gallery.length : 0;
    const limit = normalizeGalleryLimit(capabilities && capabilities.maxGalleryImages, DEFAULT_GALLERY_LIMIT);
    if (count > limit) {
      const error = new Error('La galería supera el límite permitido por el plan (' + limit + ' fotos).');
      error.code = 'gallery-plan-limit-exceeded';
      error.limit = limit;
      error.count = count;
      throw error;
    }
    return true;
  }

  global.VisitaLojaSubscriptionPlans = Object.freeze({
    SETTINGS_COLLECTION,
    SETTINGS_DOCUMENT,
    DEFAULT_GALLERY_LIMIT,
    MIN_GALLERY_LIMIT,
    MAX_GALLERY_LIMIT,
    normalizePlans,
    loadPlanSettings,
    findPlan,
    subscriptionPlanId,
    capabilitiesForPlace,
    validateGalleryCount
  });
})(window);
