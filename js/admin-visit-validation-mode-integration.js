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

  window.VisitaLojaVisitValidationAdminIntegration = Object.freeze({
    ensureSelector,
    setMode,
    getMode
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureSelector);
  else ensureSelector();
})();
