"use strict";

const MODES = Object.freeze({
  MERCHANT_CONFIRMATION: "merchant_confirmation",
  SELF_CHECKIN: "self_checkin"
});

function normalizeAdminVisitValidationMode(value) {
  return value === MODES.SELF_CHECKIN ? MODES.SELF_CHECKIN : MODES.MERCHANT_CONFIRMATION;
}

function validationModeForPlace(place = {}) {
  return normalizeAdminVisitValidationMode(place.validationMode);
}

function validationModePatch(value) {
  return { validationMode: normalizeAdminVisitValidationMode(value) };
}

function validationModeUiMeta(value) {
  const mode = normalizeAdminVisitValidationMode(value);
  if (mode === MODES.SELF_CHECKIN) {
    return Object.freeze({
      mode,
      label: "Sin encargado / atractivo turístico",
      description: "La visita se validará mediante el flujo seguro de autovalidación cuando ese backend esté habilitado.",
      loyaltyEnabled: false
    });
  }
  return Object.freeze({
    mode,
    label: "Con encargado",
    description: "Conserva el flujo actual: código temporal y confirmación por personal autorizado.",
    loyaltyEnabled: true
  });
}

const api = Object.freeze({
  MODES,
  normalizeAdminVisitValidationMode,
  validationModeForPlace,
  validationModePatch,
  validationModeUiMeta
});

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.VisitaLojaVisitValidationAdmin = api;
