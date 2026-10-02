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

  function loadScriptOnce(src, id) {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.onload = () => { script.dataset.loaded = "true"; resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensurePlanEditorDependencies() {
    await loadScriptOnce("js/subscription-plan-config.js", "subscriptionPlanConfigScript");
    await loadScriptOnce("js/admin-subscription-plans.js", "adminSubscriptionPlansScript");
  }

  function planEditorMessage(text, ok) {
    const el = document.getElementById("subscriptionPlanCapabilitiesMessage");
    if (!el) return;
    el.textContent = text || "";
    el.className = "text-sm rounded-xl p-3 mt-4 " + (ok ? "bg-emerald-500/10 text-emerald-200 border border-emerald-500/25" : "bg-red-500/10 text-red-200 border border-red-500/25");
    el.classList.toggle("hidden", !text);
  }

  function readPlanCards() {
    return Array.from(document.querySelectorAll("[data-plan-capability-card]")).map((card, index) => ({
      id: card.querySelector('[data-field="id"]').value.trim(),
      name: card.querySelector('[data-field="name"]').value.trim(),
      active: card.querySelector('[data-field="active"]').checked,
      monthly: card.querySelector('[data-field="monthly"]').value,
      annual: card.querySelector('[data-field="annual"]').value,
      sortOrder: index,
      features: {
        maxGalleryImages: Number(card.querySelector('[data-field="maxGalleryImages"]').value)
      }
    }));
  }

  function planCard(plan) {
    const service = window.VisitaLojaAdminSubscriptionPlans;
    const item = service.newPlan(plan);
    const card = document.createElement("div");
    card.setAttribute("data-plan-capability-card", "");
    card.className = "bg-black/25 border border-gray-800 rounded-2xl p-4";
    card.innerHTML = `
      <div class="grid sm:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
        <label class="xl:col-span-2"><span class="text-xs font-semibold block mb-1">Nombre del plan</span><input data-field="name" class="field" maxlength="80" value="${escapeHtml(item.name)}" placeholder="Por definir"></label>
        <label><span class="text-xs font-semibold block mb-1">Identificador</span><input data-field="id" class="field" maxlength="60" value="${escapeHtml(item.id)}" placeholder="plan-id"></label>
        <label><span class="text-xs font-semibold block mb-1">Precio mensual</span><input data-field="monthly" class="field" type="number" min="0" step="0.01" value="${escapeHtml(item.monthly)}" placeholder="0.00"></label>
        <label><span class="text-xs font-semibold block mb-1">Precio anual</span><input data-field="annual" class="field" type="number" min="0" step="0.01" value="${escapeHtml(item.annual)}" placeholder="0.00"></label>
        <label><span class="text-xs font-semibold block mb-1">Fotos de galería</span><input data-field="maxGalleryImages" class="field" type="number" min="0" max="100" step="1" value="${item.features.maxGalleryImages}"></label>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 mt-3">
        <label class="inline-flex items-center gap-2 text-sm"><input data-field="active" type="checkbox" class="w-5 h-5 accent-teal-500" ${item.active ? "checked" : ""}><span>Plan activo</span></label>
        <button type="button" data-remove-plan class="text-xs font-bold text-red-200 border border-red-500/30 hover:bg-red-500/10 rounded-lg px-3 py-2"><i class="fa-solid fa-trash mr-1"></i>Quitar</button>
      </div>`;
    card.querySelector("[data-remove-plan]").addEventListener("click", () => card.remove());
    return card;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  async function renderPlanCapabilitiesEditor() {
    const list = document.getElementById("subscriptionPlanCapabilitiesList");
    if (!list) return;
    list.innerHTML = '<p class="text-sm text-gray-500">Cargando configuración de planes...</p>';
    try {
      await ensurePlanEditorDependencies();
      const settings = await window.VisitaLojaAdminSubscriptionPlans.load();
      list.innerHTML = "";
      (settings.plans || []).forEach((plan) => list.appendChild(planCard(plan)));
      if (!settings.plans || !settings.plans.length) {
        list.innerHTML = '<p class="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">Todavía no hay planes configurados. Puedes crear el primero sin definir aún precios definitivos.</p>';
      }
    } catch (error) {
      list.innerHTML = '<p class="text-sm text-red-200">No se pudo cargar la configuración de planes.</p>';
      planEditorMessage(error.message || "Error al cargar planes.", false);
    }
  }

  function ensurePlanCapabilitiesEditor() {
    if (document.getElementById("subscriptionPlanCapabilitiesEditor")) return;
    const module = document.getElementById("subscriptionsModule");
    const form = document.getElementById("subscriptionsForm");
    if (!module || !form) return;

    const editor = document.createElement("section");
    editor.id = "subscriptionPlanCapabilitiesEditor";
    editor.className = "bg-teal-500/5 border border-teal-500/25 rounded-2xl p-4 sm:p-5 mb-6";
    editor.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div><p class="text-teal-300 text-xs font-black uppercase tracking-widest">Configuración central</p><h3 class="text-xl font-black mt-1">Planes y límites</h3><p class="text-xs text-gray-400 mt-1">Edita las capacidades de cada plan desde aquí. Logo y portada no cuentan dentro del límite de galería.</p></div>
        <button id="addSubscriptionPlanCapability" type="button" class="border border-teal-400/40 text-teal-200 hover:bg-teal-500/10 rounded-xl px-4 py-2 text-sm font-bold"><i class="fa-solid fa-plus mr-1"></i>Agregar plan</button>
      </div>
      <div class="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 mb-4 text-xs text-cyan-100"><i class="fa-solid fa-circle-info mr-1"></i>Los nombres, precios y límites siguen siendo editables. No se consideran definitivos hasta que tú los decidas.</div>
      <div id="subscriptionPlanCapabilitiesList" class="space-y-3"></div>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4"><p class="text-xs text-gray-500">El límite “Fotos de galería” controla solo la galería. Logo y portada son independientes.</p><button id="saveSubscriptionPlanCapabilities" type="button" class="bg-teal-500 hover:bg-teal-400 text-black font-black rounded-xl px-5 py-3"><i class="fa-solid fa-floppy-disk mr-2"></i>Guardar planes y límites</button></div>
      <p id="subscriptionPlanCapabilitiesMessage" class="hidden"></p>`;
    form.parentElement.insertBefore(editor, form);

    editor.querySelector("#addSubscriptionPlanCapability").addEventListener("click", async () => {
      await ensurePlanEditorDependencies();
      const list = document.getElementById("subscriptionPlanCapabilitiesList");
      const empty = list.querySelector("p");
      if (empty && !list.querySelector("[data-plan-capability-card]")) list.innerHTML = "";
      list.appendChild(planCard({}));
    });

    editor.querySelector("#saveSubscriptionPlanCapabilities").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      planEditorMessage("", true);
      try {
        await ensurePlanEditorDependencies();
        const plans = readPlanCards();
        await window.VisitaLojaAdminSubscriptionPlans.savePlans(plans, { note: "Actualizado desde Admin V2" });
        planEditorMessage("Planes y límites guardados correctamente.", true);
      } catch (error) {
        planEditorMessage(error.message || "No se pudo guardar la configuración.", false);
      } finally {
        button.disabled = false;
      }
    });
  }

  function initializePlanCapabilitiesEditor() {
    ensurePlanCapabilitiesEditor();
    const nav = document.getElementById("subscriptionsNavBtn");
    if (nav && !nav.dataset.planEditorBound) {
      nav.dataset.planEditorBound = "true";
      nav.addEventListener("click", () => setTimeout(renderPlanCapabilitiesEditor, 0));
    }
  }

  function initializeAdminIntegration() {
    ensureSelector();
    ensureMesaTuristicaNav();
    initializePlanCapabilitiesEditor();
  }

  window.VisitaLojaVisitValidationAdminIntegration = Object.freeze({
    ensureSelector,
    setMode,
    getMode,
    ensureMesaTuristicaNav,
    ensurePlanCapabilitiesEditor,
    renderPlanCapabilitiesEditor
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeAdminIntegration);
  else initializeAdminIntegration();
})();
