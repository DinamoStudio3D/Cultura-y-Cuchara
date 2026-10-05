"use strict";

const MODES = Object.freeze({
  MERCHANT_CONFIRMATION: "merchant_confirmation",
  SELF_CHECKIN: "self_checkin"
});

const MODE_VALUES = Object.freeze(Object.values(MODES));

function normalizeAdminVisitValidationMode(value) {
  return value === MODES.SELF_CHECKIN ? MODES.SELF_CHECKIN : MODES.MERCHANT_CONFIRMATION;
}

function isAdminVisitValidationMode(value) {
  return MODE_VALUES.includes(value);
}

function validationModeForPlace(place = {}) {
  return normalizeAdminVisitValidationMode(place.validationMode);
}

function validationModePatch(value) {
  return { validationMode: normalizeAdminVisitValidationMode(value) };
}

function validationModeRequiresMerchant(value) {
  return normalizeAdminVisitValidationMode(value) === MODES.MERCHANT_CONFIRMATION;
}

function validationModeAllowsSelfCheckin(value) {
  return normalizeAdminVisitValidationMode(value) === MODES.SELF_CHECKIN;
}

function validationModeSupportsLoyalty(value) {
  return normalizeAdminVisitValidationMode(value) === MODES.MERCHANT_CONFIRMATION;
}

function validationModeUiMeta(value) {
  const mode = normalizeAdminVisitValidationMode(value);
  if (mode === MODES.SELF_CHECKIN) {
    return Object.freeze({
      mode,
      label: "Sin encargado / atractivo turístico",
      shortLabel: "Sin encargado",
      description: "La visita se validará mediante el flujo seguro de autovalidación cuando ese backend esté habilitado.",
      qrPurpose: "Autovalidación de visita",
      merchantRequired: false,
      selfCheckinEnabled: true,
      loyaltyEnabled: false
    });
  }
  return Object.freeze({
    mode,
    label: "Con encargado",
    shortLabel: "Con encargado",
    description: "Conserva el flujo actual: código temporal y confirmación por personal autorizado.",
    qrPurpose: "Confirmación de visita por encargado",
    merchantRequired: true,
    selfCheckinEnabled: false,
    loyaltyEnabled: true
  });
}

const api = Object.freeze({
  MODES,
  MODE_VALUES,
  normalizeAdminVisitValidationMode,
  isAdminVisitValidationMode,
  validationModeForPlace,
  validationModePatch,
  validationModeRequiresMerchant,
  validationModeAllowsSelfCheckin,
  validationModeSupportsLoyalty,
  validationModeUiMeta
});

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.VisitaLojaVisitValidationAdmin = api;

/* Commercial plan naming compatibility for Admin V2.
   Internal IDs stay unchanged so existing subscriptions remain compatible. */
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    const commercialNames = Object.freeze({
      free: "Plan Gratis",
      impulse: "Plan Emprendo",
      featured: "Plan Activo",
      premium: "Plan Premium"
    });
    const analyticsMonths = Object.freeze({ free: 0, impulse: 1, featured: 3, premium: 12 });
    const legacyNames = Object.freeze({
      "Parada Presente": "Plan Gratis",
      "Plan Impulso": "Plan Emprendo",
      "Plan Destacado": "Plan Activo",
      "Plan Destacada": "Plan Activo",
      "Experiencia Premium": "Plan Premium"
    });

    function normalizeCommercialDraft() {
      let plans = [];
      try { plans = window.eval("subscriptionDraftPlans"); } catch (_) { return; }
      if (!Array.isArray(plans)) return;
      plans.forEach(plan => {
        if (!plan || !commercialNames[plan.id]) return;
        plan.name = commercialNames[plan.id];
        plan.analyticsHistoryMonths = analyticsMonths[plan.id];
        plan.features = { ...(plan.features || {}), analyticsHistoryMonths: analyticsMonths[plan.id] };
        if (Array.isArray(plan.benefits)) {
          plan.benefits = plan.benefits.map(text => {
            let value = String(text || "");
            Object.entries(legacyNames).forEach(([oldName, newName]) => { value = value.replaceAll(oldName, newName); });
            return value;
          });
        }
      });
    }

    function normalizeRenderedCards() {
      const editor = document.getElementById("subscriptionPlansEditor");
      if (!editor) return;
      let plans = [];
      try { plans = window.eval("subscriptionDraftPlans"); } catch (_) { return; }
      Array.from(editor.children).forEach((card, index) => {
        const plan = plans[index];
        if (!plan || !commercialNames[plan.id]) return;
        const nameInput = card.querySelector('[data-plan-field="name"]');
        if (nameInput) nameInput.value = commercialNames[plan.id];
        const heading = card.querySelector("strong.text-teal-200");
        if (heading) heading.textContent = commercialNames[plan.id];
        const benefits = card.querySelector('[data-plan-field="benefits"]');
        if (benefits) benefits.value = (plan.benefits || []).join("\n");

        let history = card.querySelector("[data-plan-analytics-history]");
        if (!history) {
          history = document.createElement("div");
          history.dataset.planAnalyticsHistory = "true";
          history.className = "rounded-xl border border-sky-500/25 bg-sky-500/10 p-3";
          const description = card.querySelector('[data-plan-field="description"]')?.closest("label");
          if (description) description.insertAdjacentElement("afterend", history); else card.appendChild(history);
        }
        const months = analyticsMonths[plan.id];
        history.innerHTML = `<span class="text-xs font-black text-sky-200 block">Historial de estadísticas</span><span class="text-sm text-gray-300">${months === 0 ? "No incluido" : months === 1 ? "Último mes" : `Últimos ${months} meses`}</span>`;
      });
    }

    function installCommercialPlanNormalizer() {
      if (typeof window.renderSubscriptionEditors !== "function" || window.renderSubscriptionEditors.__commercialNamesIntegrated) return;
      const original = window.renderSubscriptionEditors;
      const wrapped = function () {
        normalizeCommercialDraft();
        const result = original.apply(this, arguments);
        normalizeRenderedCards();
        return result;
      };
      wrapped.__commercialNamesIntegrated = true;
      window.renderSubscriptionEditors = wrapped;
      normalizeCommercialDraft();
      normalizeRenderedCards();
    }

    installCommercialPlanNormalizer();
    setTimeout(installCommercialPlanNormalizer, 0);
    setTimeout(() => { normalizeCommercialDraft(); normalizeRenderedCards(); }, 500);
  });
}
