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
