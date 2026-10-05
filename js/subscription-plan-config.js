(function (global) {
  'use strict';

  const SETTINGS_COLLECTION = 'settings';
  const SETTINGS_DOCUMENT = 'subscriptions';
  const DEFAULT_GALLERY_LIMIT = 6;
  const MIN_GALLERY_LIMIT = 0;
  const MAX_GALLERY_LIMIT = 100;
  const DEFAULT_ANALYTICS_PERIOD_MONTHS = 1;
  const MIN_ANALYTICS_PERIOD_MONTHS = 0;
  const MAX_ANALYTICS_PERIOD_MONTHS = 36;
  const DEFAULT_ANALYTICS_PERIOD_BY_PLAN = Object.freeze({
    free: 0,
    gratis: 0,
    impulse: 1,
    impulso: 1,
    featured: 3,
    destacado: 3,
    pro: 3,
    premium: 12
  });

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizePlanId(value) {
    return cleanText(value).toLowerCase();
  }

  function defaultAnalyticsPeriodMonths(planId) {
    const normalizedId = normalizePlanId(planId);
    return Object.prototype.hasOwnProperty.call(DEFAULT_ANALYTICS_PERIOD_BY_PLAN, normalizedId)
      ? DEFAULT_ANALYTICS_PERIOD_BY_PLAN[normalizedId]
      : DEFAULT_ANALYTICS_PERIOD_MONTHS;
  }

  function normalizeGalleryLimit(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(MAX_GALLERY_LIMIT, Math.max(MIN_GALLERY_LIMIT, parsed));
  }

  function normalizeAnalyticsPeriodMonths(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(MAX_ANALYTICS_PERIOD_MONTHS, Math.max(MIN_ANALYTICS_PERIOD_MONTHS, parsed));
  }

  function normalizePlan(plan, index) {
    const source = plan && typeof plan === 'object' ? plan : {};
    const features = source.features && typeof source.features === 'object' ? source.features : {};
    const id = cleanText(source.id || source.key || source.slug || source.code || source.name) || ('plan-' + (index + 1));
    const defaultAnalyticsMonths = defaultAnalyticsPeriodMonths(id);
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
        ),
        analyticsPeriodMonths: normalizeAnalyticsPeriodMonths(
          features.analyticsPeriodMonths != null ? features.analyticsPeriodMonths :
            (features.statsPeriodMonths != null ? features.statsPeriodMonths :
              (source.analyticsPeriodMonths != null ? source.analyticsPeriodMonths : source.statsPeriodMonths)),
          defaultAnalyticsMonths
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
    const assignedPlan = findPlan(settings, planId);
    const plan = assignedPlan && assignedPlan.active !== false ? assignedPlan : null;
    const features = plan && plan.features ? plan.features : {};
    const defaultAnalyticsMonths = defaultAnalyticsPeriodMonths(planId);
    return {
      planId,
      plan,
      assignedPlan,
      planInactive: Boolean(assignedPlan && assignedPlan.active === false),
      maxGalleryImages: normalizeGalleryLimit(features.maxGalleryImages, DEFAULT_GALLERY_LIMIT),
      analyticsPeriodMonths: normalizeAnalyticsPeriodMonths(features.analyticsPeriodMonths, defaultAnalyticsMonths),
      analyticsEnabled: normalizeAnalyticsPeriodMonths(features.analyticsPeriodMonths, defaultAnalyticsMonths) > 0,
      currentGalleryCount: galleryCount(place && place.gallery),
      usesConfiguredPlan: Boolean(plan)
    };
  }

  function galleryCount(gallery) {
    return Array.isArray(gallery) ? gallery.length : 0;
  }

  function galleryStatus(gallery, capabilities) {
    const count = galleryCount(gallery);
    const limit = normalizeGalleryLimit(capabilities && capabilities.maxGalleryImages, DEFAULT_GALLERY_LIMIT);
    return {
      count,
      limit,
      remaining: Math.max(0, limit - count),
      overLimit: count > limit,
      atLimit: count >= limit,
      canAdd: count < limit
    };
  }

  function validateGalleryCount(gallery, capabilities) {
    const status = galleryStatus(gallery, capabilities);
    const currentCount = Math.max(0, Number.parseInt(capabilities && capabilities.currentGalleryCount, 10) || 0);
    const grandfatheredLimit = Math.max(status.limit, currentCount);
    if (status.count > grandfatheredLimit) {
      const error = new Error(
        currentCount > status.limit
          ? 'Tu galería supera el límite actual del plan. Conservaremos tus fotos, pero no puedes añadir nuevas hasta volver a estar dentro del límite (' + status.limit + ' fotos).'
          : 'La galería supera el límite permitido por el plan (' + status.limit + ' fotos).'
      );
      error.code = 'gallery-plan-limit-exceeded';
      error.limit = status.limit;
      error.count = status.count;
      error.currentCount = currentCount;
      throw error;
    }
    return true;
  }

  function validateGalleryTransition(previousGallery, nextGallery, capabilities) {
    const previous = galleryStatus(previousGallery, capabilities);
    const next = galleryStatus(nextGallery, capabilities);

    if (!next.overLimit) return true;

    if (previous.overLimit && next.count <= previous.count) return true;

    const error = new Error(
      previous.overLimit
        ? 'Tu galería supera el límite actual del plan. Conservaremos tus fotos, pero no puedes añadir nuevas hasta volver a estar dentro del límite.'
        : 'La galería supera el límite permitido por el plan (' + next.limit + ' fotos).'
    );
    error.code = 'gallery-plan-limit-exceeded';
    error.limit = next.limit;
    error.count = next.count;
    error.previousCount = previous.count;
    throw error;
  }

  global.VisitaLojaSubscriptionPlans = Object.freeze({
    SETTINGS_COLLECTION,
    SETTINGS_DOCUMENT,
    DEFAULT_GALLERY_LIMIT,
    MIN_GALLERY_LIMIT,
    MAX_GALLERY_LIMIT,
    DEFAULT_ANALYTICS_PERIOD_MONTHS,
    MIN_ANALYTICS_PERIOD_MONTHS,
    MAX_ANALYTICS_PERIOD_MONTHS,
    DEFAULT_ANALYTICS_PERIOD_BY_PLAN,
    defaultAnalyticsPeriodMonths,
    normalizePlans,
    loadPlanSettings,
    findPlan,
    subscriptionPlanId,
    capabilitiesForPlace,
    galleryStatus,
    validateGalleryCount,
    validateGalleryTransition
  });
})(window);
