(function (global) {
  'use strict';

  const api = global.VisitaLojaSubscriptionPlans;
  if (!api) {
    console.warn('[VisitaLoja] subscription-plan-config.js debe cargarse antes de admin-subscription-plans.js');
    return;
  }

  let settingsCache = null;

  function adminApp() {
    if (!global.firebase || !Array.isArray(firebase.apps)) throw new Error('Firebase no está disponible.');
    return firebase.apps.find((app) => app && app.name === 'viveLojaAdmin') || null;
  }

  function db() {
    const app = adminApp();
    if (!app) throw new Error('El panel administrativo todavía está inicializando Firebase. Intenta nuevamente en un momento.');
    return app.firestore();
  }

  function auth() {
    const app = adminApp();
    return app ? app.auth() : null;
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
    const analyticsOverride = plan && plan.analyticsPeriodMonths;
    const source = analyticsOverride == null ? plan : {
      ...plan,
      features: {
        ...((plan && plan.features) || {}),
        analyticsPeriodMonths: analyticsOverride
      }
    };
    const normalized = api.normalizePlans([source])[0];
    const rawMonthly = Number(plan && plan.monthly);
    const rawAnnual = Number(plan && plan.annual);
    return {
      ...plan,
      id: normalized.id,
      name: api.commercialPlanName(normalized.id, normalized.name),
      active: normalized.active,
      ...(Number.isFinite(rawMonthly) ? { monthly: rawMonthly } : {}),
      ...(Number.isFinite(rawAnnual) ? { annual: rawAnnual } : {}),
      features: {
        ...((plan && plan.features) || {}),
        maxGalleryImages: normalized.features.maxGalleryImages,
        analyticsPeriodMonths: normalized.features.analyticsPeriodMonths
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
      const analyticsMonths = cleaned.features.analyticsPeriodMonths;
      if (!Number.isInteger(analyticsMonths) || analyticsMonths < api.MIN_ANALYTICS_PERIOD_MONTHS || analyticsMonths > api.MAX_ANALYTICS_PERIOD_MONTHS) {
        throw new Error('El historial de estadísticas debe estar entre ' + api.MIN_ANALYTICS_PERIOD_MONTHS + ' y ' + api.MAX_ANALYTICS_PERIOD_MONTHS + ' meses.');
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
    const currentUser = auth() && auth().currentUser;
    if (currentUser && currentUser.email) payload.updatedBy = currentUser.email;
    if (options && options.note) payload.updateNote = String(options.note).slice(0, 240);

    await db().collection(api.SETTINGS_COLLECTION).doc(api.SETTINGS_DOCUMENT).set(payload, { merge: true });
    settingsCache = { ...(settingsCache || {}), ...payload, plans: api.normalizePlans(cleanedPlans) };
    return current();
  }

  function newPlan(seed) {
    const source = seed && typeof seed === 'object' ? seed : {};
    const planId = source.id || '';
    return {
      id: planId,
      name: api.commercialPlanName(planId, source.name || ''),
      active: source.active !== false,
      monthly: source.monthly == null ? '' : source.monthly,
      annual: source.annual == null ? '' : source.annual,
      features: {
        ...(source.features || {}),
        maxGalleryImages: Number.isFinite(Number(source.features && source.features.maxGalleryImages))
          ? Number(source.features.maxGalleryImages)
          : api.DEFAULT_GALLERY_LIMIT,
        analyticsPeriodMonths: Number.isFinite(Number(source.features && source.features.analyticsPeriodMonths))
          ? Number(source.features.analyticsPeriodMonths)
          : api.defaultAnalyticsPeriodMonths(planId)
      }
    };
  }

  function analyticsLabel(months) {
    const value = Number(months) || 0;
    if (value <= 0) return 'Sin estadísticas';
    if (value === 1) return 'Últimos 30 días';
    return 'Últimos ' + value + ' meses';
  }

  function enhancePlanEditor() {
    const editor = document.getElementById('subscriptionPlansEditor');
    if (!editor) return;
    const cards = Array.from(editor.querySelectorAll('article'));
    cards.forEach((card, index) => {
      if (card.querySelector('[data-analytics-history-control]')) return;
      const nameInput = card.querySelector('[data-plan-field="name"]');
      const planId = ['free', 'impulse', 'featured', 'premium'][index] || '';
      const commercialName = api.commercialPlanName(planId, nameInput && nameInput.value);
      if (nameInput && planId) nameInput.value = commercialName;
      const title = card.querySelector('strong');
      if (title && planId) title.textContent = commercialName;

      const months = api.defaultAnalyticsPeriodMonths(planId);
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-analytics-history-control', 'true');
      wrapper.className = 'border border-sky-500/20 bg-sky-500/5 rounded-xl p-3';
      wrapper.innerHTML = '<label><span class="text-xs font-semibold block mb-1"><i class="fa-solid fa-chart-line text-sky-300 mr-1"></i>Historial de estadísticas</span><div class="flex items-center gap-2"><input data-plan-field="analyticsPeriodMonths" data-plan-index="' + index + '" class="field" type="number" min="0" max="36" step="1" value="' + months + '"><span class="text-xs text-gray-400 whitespace-nowrap">meses</span></div><small class="block text-[11px] text-gray-500 mt-1" data-analytics-history-label>' + analyticsLabel(months) + '</small></label>';
      const services = Array.from(card.querySelectorAll('div')).find((node) => node.querySelector('[data-plan-feature]'));
      if (services) card.insertBefore(wrapper, services);
      else card.appendChild(wrapper);
      const input = wrapper.querySelector('input');
      input.addEventListener('input', function () {
        wrapper.querySelector('[data-analytics-history-label]').textContent = analyticsLabel(input.value);
      });
    });
  }

  function watchPlanEditor() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', watchPlanEditor, { once: true });
      return;
    }
    const editor = document.getElementById('subscriptionPlansEditor');
    if (!editor) return;
    enhancePlanEditor();
    const observer = new MutationObserver(function () { enhancePlanEditor(); });
    observer.observe(editor, { childList: true });
  }

  watchPlanEditor();

  global.VisitaLojaAdminSubscriptionPlans = Object.freeze({
    load,
    current,
    savePlans,
    validatePlans,
    newPlan,
    enhancePlanEditor
  });
})(window);
