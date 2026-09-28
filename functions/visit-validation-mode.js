"use strict";

const MODES = Object.freeze({
  MERCHANT_CONFIRMATION: "merchant_confirmation",
  SELF_CHECKIN: "self_checkin"
});

const DEFAULT_MODE = MODES.MERCHANT_CONFIRMATION;

function normalizeValidationMode(value) {
  return value === MODES.SELF_CHECKIN ? MODES.SELF_CHECKIN : DEFAULT_MODE;
}

function visitCapabilities(place = {}) {
  const validationMode = normalizeValidationMode(place.validationMode);
  const selfCheckin = validationMode === MODES.SELF_CHECKIN;
  return Object.freeze({
    validationMode,
    requiresMerchantConfirmation: !selfCheckin,
    allowsSelfCheckin: selfCheckin,
    awardsPassport: true,
    syncsMissions: true,
    awardsCommercialLoyalty: !selfCheckin
  });
}

module.exports = Object.freeze({
  MODES,
  DEFAULT_MODE,
  normalizeValidationMode,
  visitCapabilities
});
