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

/* Direct Firebase Storage uploader for place audioguides.
   Keeps the existing URL fields as the source of truth, so the current
   Firestore save flow does not need to change. */
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
    let storageSdkPromise = null;

    function ensureStorageSdk() {
      if (window.firebase?.storage) return Promise.resolve();
      if (storageSdkPromise) return storageSdkPromise;
      storageSdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage-compat.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("No se pudo cargar Firebase Storage."));
        document.head.appendChild(script);
      });
      return storageSdkPromise;
    }

    function safeSegment(value, fallback) {
      const clean = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
      return clean || fallback;
    }

    function setStatus(node, text, tone = "muted") {
      if (!node) return;
      node.textContent = text;
      node.className = `text-xs ${tone === "ok" ? "text-emerald-300" : tone === "error" ? "text-red-300" : "text-gray-400"}`;
    }

    async function uploadPlaceAudio(file, language, input, preview, status, button) {
      if (!file) return;
      if (!String(file.type || "").startsWith("audio/")) {
        setStatus(status, "Selecciona un archivo de audio válido.", "error");
        return;
      }
      if (file.size > MAX_AUDIO_BYTES) {
        setStatus(status, "El archivo supera el límite de 20 MB.", "error");
        return;
      }
      button.disabled = true;
      setStatus(status, "Preparando subida…");
      try {
        await ensureStorageSdk();
        const app = window.firebase.app("viveLojaAdmin");
        const storage = app.storage();
        const placeId = document.getElementById("placeEditId")?.value;
        const title = document.getElementById("placeTitle")?.value;
        const placeKey = safeSegment(placeId || title, "nueva-parada");
        const filename = safeSegment(file.name, `audio-${Date.now()}.mp3`);
        const path = `audioguias/${placeKey}/${language}/${Date.now()}-${filename}`;
        const ref = storage.ref().child(path);
        const task = ref.put(file, { contentType: file.type || "audio/mpeg" });
        await new Promise((resolve, reject) => {
          task.on("state_changed", snap => {
            const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
            setStatus(status, `Subiendo… ${pct}%`);
          }, reject, resolve);
        });
        const url = await ref.getDownloadURL();
        input.value = url;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        if (preview) {
          preview.src = url;
          preview.classList.remove("hidden");
          preview.load();
        }
        if (typeof window.setAdminUnsavedChanges === "function") window.setAdminUnsavedChanges(true);
        setStatus(status, "Audio subido. Guarda la parada para asociarlo definitivamente.", "ok");
      } catch (error) {
        console.error("Error al subir audioguía:", error);
        const detail = error?.code === "storage/unauthorized" ? "Firebase Storage no autorizó la subida. Revisa que tu sesión de administrador siga activa." : (error?.message || "No se pudo subir el audio.");
        setStatus(status, detail, "error");
      } finally {
        button.disabled = false;
      }
    }

    function enhanceAudioField(inputId, previewId, language, label) {
      const input = document.getElementById(inputId);
      if (!input || input.dataset.directAudioUpload === "true") return;
      input.dataset.directAudioUpload = "true";
      const preview = document.getElementById(previewId);
      const wrap = document.createElement("div");
      wrap.className = "space-y-2";
      wrap.innerHTML = `<input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" class="hidden" data-audio-file><div class="flex flex-wrap gap-2"><button type="button" class="rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-2 text-xs font-black" data-audio-pick><i class="fa-solid fa-cloud-arrow-up mr-1"></i>Subir audio ${label}</button><button type="button" class="rounded-lg border border-red-500/30 text-red-200 hover:bg-red-500/10 px-3 py-2 text-xs font-bold" data-audio-remove><i class="fa-solid fa-trash mr-1"></i>Quitar</button></div><p class="text-xs text-gray-400" data-audio-status>MP3 u otro audio compatible · máximo 20 MB.</p>`;
      input.insertAdjacentElement("afterend", wrap);
      const fileInput = wrap.querySelector("[data-audio-file]");
      const pick = wrap.querySelector("[data-audio-pick]");
      const remove = wrap.querySelector("[data-audio-remove]");
      const status = wrap.querySelector("[data-audio-status]");
      pick.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => uploadPlaceAudio(fileInput.files?.[0], language, input, preview, status, pick));
      remove.addEventListener("click", () => {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        if (preview) { preview.pause(); preview.removeAttribute("src"); preview.classList.add("hidden"); preview.load(); }
        fileInput.value = "";
        if (typeof window.setAdminUnsavedChanges === "function") window.setAdminUnsavedChanges(true);
        setStatus(status, "Audio quitado del formulario. Guarda la parada para aplicar el cambio.");
      });
    }

    function enhancePlaceAudioUploaders() {
      enhanceAudioField("placeAudioUrl", "placeAudioPreviewEs", "es", "en español");
      enhanceAudioField("placeAudioUrlEn", "placeAudioPreviewEn", "en", "en inglés");
    }

    enhancePlaceAudioUploaders();
    const observer = new MutationObserver(enhancePlaceAudioUploaders);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
