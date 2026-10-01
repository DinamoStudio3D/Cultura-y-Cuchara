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
    installQrTargetSync(form);
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

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function installQrTargetSync(form) {
    if (!form || form.dataset.visitQrTargetSync === "1") return;
    form.dataset.visitQrTargetSync = "1";

    form.addEventListener("submit", function () {
      const placeId = String(document.getElementById("placeEditId")?.value || "").trim();
      const title = String(document.getElementById("placeTitle")?.value || "").trim();
      const mode = getMode();
      if (!placeId || !title) return;

      const slug = slugify(title);
      const qrId = `parada-${slug}`;

      // The main admin submit handler writes the place first. We then verify that
      // Firestore contains the selected mode before changing an already-issued QR.
      window.setTimeout(async function () {
        try {
          const firestore = firebase.firestore();
          const placeSnap = await firestore.collection("locales").doc(placeId).get();
          if (!placeSnap.exists) return;
          const savedMode = api.normalizeAdminVisitValidationMode(placeSnap.data()?.validationMode);
          if (savedMode !== mode) return;

          const qrRef = firestore.collection("qrCodes").doc(qrId);
          const qrSnap = await qrRef.get();
          if (!qrSnap.exists) return;

          const targetUrl = savedMode === "self_checkin"
            ? `${window.location.origin}/visita.html?place=${encodeURIComponent(placeId)}`
            : `${window.location.origin}/fidelidad.html?checkin=${encodeURIComponent(slug)}`;

          await qrRef.set({
            targetUrl,
            visit: {
              placeId,
              validationMode: savedMode,
              purpose: savedMode === "self_checkin" ? "passport_missions" : "merchant_confirmation"
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: firebase.auth().currentUser?.email || ""
          }, { merge: true });
        } catch (error) {
          console.warn("No se pudo sincronizar automáticamente el destino del QR de visita:", error);
        }
      }, 900);
    });
  }

  window.VisitaLojaVisitValidationAdminIntegration = Object.freeze({
    ensureSelector,
    setMode,
    getMode
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureSelector);
  else ensureSelector();
})();
