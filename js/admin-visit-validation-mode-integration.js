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

  function adminMessage(text, ok) {
    const node = document.getElementById("placeFormMessage");
    if (typeof window.message === "function" && node) window.message(node, text, ok);
    else if (!ok) console.warn(text);
  }

  async function waitForSavedMode(firestore, placeId, expectedMode) {
    let lastMode = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const snap = await firestore.collection("locales").doc(placeId).get();
      if (snap.exists) {
        lastMode = api.normalizeAdminVisitValidationMode(snap.data()?.validationMode);
        if (lastMode === expectedMode) return lastMode;
      }
      await new Promise(resolve => window.setTimeout(resolve, 350));
    }
    throw new Error(`La parada se guardó sin confirmar el modo de validación esperado (${expectedMode}); modo leído: ${lastMode || "sin valor"}.`);
  }

  async function syncExistingQrTarget(placeId, title, expectedMode) {
    const firestore = firebase.firestore();
    const savedMode = await waitForSavedMode(firestore, placeId, expectedMode);
    const slug = slugify(title);
    if (!slug) throw new Error("No se pudo calcular el identificador del QR de la parada.");

    const qrId = `parada-${slug}`;
    const qrRef = firestore.collection("qrCodes").doc(qrId);
    const qrSnap = await qrRef.get();
    const targetUrl = savedMode === "self_checkin"
      ? `${window.location.origin}/visita.html?place=${encodeURIComponent(placeId)}`
      : `${window.location.origin}/fidelidad.html?checkin=${encodeURIComponent(slug)}`;

    const now = firebase.firestore.FieldValue.serverTimestamp();
    const userEmail = firebase.auth().currentUser?.email || "";
    const payload = {
      id: qrId,
      name: qrSnap.exists ? (qrSnap.data()?.name || title || qrId) : (title || qrId),
      type: qrSnap.exists ? (qrSnap.data()?.type || "stop") : "stop",
      destinationType: qrSnap.exists ? (qrSnap.data()?.destinationType || "stop") : "stop",
      placeId,
      placeSlug: slug,
      targetUrl,
      visit: {
        placeId,
        validationMode: savedMode,
        purpose: savedMode === "self_checkin" ? "passport_missions" : "merchant_confirmation"
      },
      updatedAt: now,
      updatedBy: userEmail
    };

    if (!qrSnap.exists) {
      payload.createdAt = now;
      payload.createdBy = userEmail;
    }

    await qrRef.set(payload, { merge: true });

    const verifySnap = await qrRef.get();
    if (!verifySnap.exists) throw new Error("Firestore no confirmó la creación del QR estable.");
    const storedTarget = String(verifySnap.data()?.targetUrl || "");
    if (storedTarget !== targetUrl) throw new Error("Firestore no confirmó el nuevo destino del QR.");
    return { updated: qrSnap.exists, created: !qrSnap.exists, qrId, targetUrl, savedMode };
  }

  function installQrTargetSync(form) {
    if (!form || form.dataset.visitQrTargetSync === "1") return;
    form.dataset.visitQrTargetSync = "1";

    form.addEventListener("submit", function () {
      const placeId = String(document.getElementById("placeEditId")?.value || "").trim();
      const title = String(document.getElementById("placeTitle")?.value || "").trim();
      const mode = getMode();
      if (!placeId || !title) return;

      window.setTimeout(async function () {
        try {
          const result = await syncExistingQrTarget(placeId, title, mode);
          if (result.created) {
            adminMessage(
              mode === "self_checkin"
                ? "Parada actualizada correctamente. Se creó el QR estable y ahora abre la visita sin encargado."
                : "Parada actualizada correctamente. Se creó el QR estable y ahora abre la confirmación con encargado.",
              true
            );
          } else {
            adminMessage(
              mode === "self_checkin"
                ? "Parada actualizada correctamente. El QR existente ahora abre la visita sin encargado."
                : "Parada actualizada correctamente. El QR existente ahora abre la confirmación con encargado.",
              true
            );
          }
        } catch (error) {
          console.error("VISITALOJA_VISIT_QR_SYNC", error);
          adminMessage(`La parada se guardó, pero no pudimos crear o actualizar su QR: ${error?.message || "error desconocido"}`, false);
        }
      }, 100);
    });
  }

  window.VisitaLojaVisitValidationAdminIntegration = Object.freeze({
    ensureSelector,
    setMode,
    getMode,
    syncExistingQrTarget
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureSelector);
  else ensureSelector();
})();
