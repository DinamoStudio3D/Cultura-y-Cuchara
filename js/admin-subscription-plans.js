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

  function planIdFromName(value, index) {
    const text = String(value || '').trim().toLowerCase();
    if (text.includes('gratis') || text.includes('presente')) return 'free';
    if (text.includes('emprendo') || text.includes('impulso')) return 'impulse';
    if (text.includes('activo') || text.includes('destacado')) return 'featured';
    if (text.includes('premium')) return 'premium';
    return ['free', 'impulse', 'featured', 'premium'][index] || '';
  }

  function findPlanCard(input, editor) {
    let node = input && input.parentElement;
    while (node && node !== editor) {
      const text = node.textContent || '';
      if (text.includes('Precio mensual') && text.includes('Precio anual') && text.includes('Beneficios')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function enhancePlanEditor() {
    const editor = document.getElementById('subscriptionPlansEditor');
    if (!editor) return;

    const allInputs = Array.from(editor.querySelectorAll('input'));
    const knownNames = ['parada presente', 'plan impulso', 'plan destacado', 'experiencia premium', 'plan gratis', 'plan emprendo', 'plan activo', 'plan premium'];
    const nameInputs = allInputs.filter((input) => knownNames.includes(String(input.value || '').trim().toLowerCase()));

    nameInputs.slice(0, 4).forEach((nameInput, index) => {
      const card = findPlanCard(nameInput, editor);
      if (!card) return;
      const planId = planIdFromName(nameInput.value, index);
      const commercialName = api.commercialPlanName(planId, nameInput.value);
      nameInput.value = commercialName;
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));

      const headings = Array.from(card.querySelectorAll('strong,h3,h4')).filter((node) => {
        const text = String(node.textContent || '').trim().toLowerCase();
        return knownNames.includes(text);
      });
      headings.forEach((node) => { node.textContent = commercialName; });

      if (card.querySelector('[data-analytics-history-control]')) return;
      const months = api.defaultAnalyticsPeriodMonths(planId);
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-analytics-history-control', 'true');
      wrapper.className = 'border border-sky-500/20 bg-sky-500/5 rounded-xl p-3';
      wrapper.innerHTML = '<label><span class="text-xs font-semibold block mb-1"><i class="fa-solid fa-chart-line text-sky-300 mr-1"></i>Historial de estadísticas</span><div class="flex items-center gap-2"><input data-plan-field="analyticsPeriodMonths" data-plan-id="' + planId + '" class="field" type="number" min="0" max="36" step="1" value="' + months + '"><span class="text-xs text-gray-400 whitespace-nowrap">meses</span></div><small class="block text-[11px] text-gray-500 mt-1" data-analytics-history-label>' + analyticsLabel(months) + '</small></label>';

      const benefitsLabel = Array.from(card.querySelectorAll('span,label')).find((node) => String(node.textContent || '').includes('Beneficios (uno por línea)'));
      const benefitsBlock = benefitsLabel ? benefitsLabel.closest('label') : null;
      if (benefitsBlock && benefitsBlock.parentElement === card) card.insertBefore(wrapper, benefitsBlock);
      else if (benefitsBlock && benefitsBlock.parentElement) benefitsBlock.parentElement.insertBefore(wrapper, benefitsBlock);
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
    let scheduled = false;
    const observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        enhancePlanEditor();
      });
    });
    observer.observe(editor, { childList: true, subtree: true });
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
