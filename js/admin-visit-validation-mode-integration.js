"use strict";

(function () {
  const api = window.VisitaLojaVisitValidationAdmin;
  if (!api) return;

  function findPlaceForm() {
    return document.getElementById("placeForm");
  }

  function ensureSelector() {
    const form = findPlaceForm();
    if (!form || document.getElementById("placeValidationMode")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "placeValidationModeField";
    wrapper.className = "sm:col-span-2";
    wrapper.innerHTML = `
      <label class="block">
        <span class="text-sm font-semibold block mb-2">Validación de visita</span>
        <select id="placeValidationMode" class="field">
          <option value="merchant_confirmation">Con encargado</option>
          <option value="self_checkin">Sin encargado / atractivo turístico</option>
        </select>
      </label>
      <p id="placeValidationModeHelp" class="text-xs text-gray-400 mt-2"></p>
    `;

    const submit = form.querySelector('button[type="submit"]');
    if (submit && submit.parentElement) submit.parentElement.insertBefore(wrapper, submit);
    else form.appendChild(wrapper);

    const select = wrapper.querySelector("#placeValidationMode");
    select.addEventListener("change", renderHelp);
    renderHelp();
  }

  function ensureMesaTuristicaNav() {
    if (document.getElementById("mesaTuristicaNavLink")) return;
    const postcards = document.getElementById("postcardsNavBtn");
    const navItems = postcards && postcards.parentElement;
    if (!navItems) return;

    const link = document.createElement("a");
    link.id = "mesaTuristicaNavLink";
    link.setAttribute("data-nav-item", "");
    link.href = "gestion-mesa-turistica.html";
    link.className = "block w-full text-left text-cyan-200 hover:bg-cyan-500/10 font-bold rounded-xl px-4 py-3";
    link.innerHTML = '<i class="fa-solid fa-people-group w-6"></i>Mesa Turística';
    link.title = "Administrar información, agenda, noticias, integrantes, galería y contacto de la Mesa Turística de Loja";
    navItems.appendChild(link);
  }

  function renderHelp() {
    const select = document.getElementById("placeValidationMode");
    const help = document.getElementById("placeValidationModeHelp");
    if (!select || !help) return;
    const meta = api.validationModeUiMeta(select.value);
    help.textContent = meta.description + (meta.loyaltyEnabled ? " Fidelidad comercial permanece habilitada." : " No habilita Fidelidad comercial.");
  }

  function setMode(value) {
    ensureSelector();
    const select = document.getElementById("placeValidationMode");
    if (!select) return;
    select.value = api.normalizeAdminVisitValidationMode(value);
    renderHelp();
  }

  function getMode() {
    const select = document.getElementById("placeValidationMode");
    return api.normalizeAdminVisitValidationMode(select && select.value);
  }

  function subscriptionDraft() {
    try {
      const plans = window.eval("subscriptionDraftPlans");
      return Array.isArray(plans) ? plans : [];
    } catch (_) {
      return [];
    }
  }

  function normalizedGalleryLimit(plan) {
    const raw = Number(plan && plan.features && plan.features.maxGalleryImages);
    return Number.isInteger(raw) && raw >= 0 ? Math.min(raw, 100) : 6;
  }

  function injectGalleryLimitsIntoExistingPlanEditor() {
    const editor = document.getElementById("subscriptionPlansEditor");
    if (!editor) return;
    const plans = subscriptionDraft();
    const cards = Array.from(editor.children);
    cards.forEach((card, index) => {
      if (card.querySelector("[data-plan-gallery-limit]")) return;
      const plan = plans[index] || {};
      const description = card.querySelector('[data-plan-field="description"]');
      const descriptionLabel = description && description.closest("label");
      if (!descriptionLabel) return;

      const field = document.createElement("label");
      field.className = "block bg-teal-500/10 border border-teal-500/25 rounded-xl p-3";
      field.innerHTML = `<span class="text-xs font-black text-teal-200 block mb-1"><i class="fa-solid fa-images mr-1"></i>Máximo de fotos en galería</span><input data-plan-gallery-limit data-plan-index="${index}" class="field" type="number" min="0" max="100" step="1" value="${normalizedGalleryLimit(plan)}"><span class="text-[11px] text-gray-400 mt-1 block">Solo cuenta la galería. Logo y portada son independientes.</span>`;
      descriptionLabel.insertAdjacentElement("afterend", field);
    });
  }

  function syncGalleryLimitsIntoDraft() {
    const plans = subscriptionDraft();
    document.querySelectorAll("[data-plan-gallery-limit]").forEach((input) => {
      const index = Number(input.dataset.planIndex);
      const plan = plans[index];
      if (!plan) return;
      const parsed = Number.parseInt(input.value, 10);
      const limit = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 6;
      plan.features = { ...(plan.features || {}), maxGalleryImages: limit };
      input.value = String(limit);
    });
  }

  function integrateGalleryLimitsWithPlanEditor() {
    if (typeof window.renderSubscriptionEditors === "function" && !window.renderSubscriptionEditors.__galleryLimitsIntegrated) {
      const originalRender = window.renderSubscriptionEditors;
      const wrappedRender = function () {
        const result = originalRender.apply(this, arguments);
        injectGalleryLimitsIntoExistingPlanEditor();
        return result;
      };
      wrappedRender.__galleryLimitsIntegrated = true;
      window.renderSubscriptionEditors = wrappedRender;
    }

    if (typeof window.syncSubscriptionEditors === "function" && !window.syncSubscriptionEditors.__galleryLimitsIntegrated) {
      const originalSync = window.syncSubscriptionEditors;
      const wrappedSync = function () {
        const result = originalSync.apply(this, arguments);
        syncGalleryLimitsIntoDraft();
        return result;
      };
      wrappedSync.__galleryLimitsIntegrated = true;
      window.syncSubscriptionEditors = wrappedSync;
    }

    injectGalleryLimitsIntoExistingPlanEditor();
  }

  function initializeAdminIntegration() {
    ensureSelector();
    ensureMesaTuristicaNav();
    integrateGalleryLimitsWithPlanEditor();
  }

  window.VisitaLojaVisitValidationAdminIntegration = Object.freeze({
    ensureSelector,
    setMode,
    getMode,
    ensureMesaTuristicaNav,
    integrateGalleryLimitsWithPlanEditor,
    injectGalleryLimitsIntoExistingPlanEditor
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeAdminIntegration);
  else initializeAdminIntegration();
})();
