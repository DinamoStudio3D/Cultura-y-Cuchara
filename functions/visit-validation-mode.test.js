"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MODES,
  DEFAULT_MODE,
  normalizeValidationMode,
  visitCapabilities
} = require("./visit-validation-mode");

test("existing places default to merchant confirmation", () => {
  assert.equal(normalizeValidationMode(undefined), DEFAULT_MODE);
  assert.equal(normalizeValidationMode(""), MODES.MERCHANT_CONFIRMATION);
  assert.deepEqual(visitCapabilities({}), {
    validationMode: MODES.MERCHANT_CONFIRMATION,
    requiresMerchantConfirmation: true,
    allowsSelfCheckin: false,
    awardsPassport: true,
    syncsMissions: true,
    awardsCommercialLoyalty: true
  });
});

test("self check-in never grants commercial loyalty", () => {
  assert.deepEqual(visitCapabilities({ validationMode: MODES.SELF_CHECKIN }), {
    validationMode: MODES.SELF_CHECKIN,
    requiresMerchantConfirmation: false,
    allowsSelfCheckin: true,
    awardsPassport: true,
    syncsMissions: true,
    awardsCommercialLoyalty: false
  });
});

test("unknown values fail closed to the current merchant flow", () => {
  assert.equal(normalizeValidationMode("automatic"), MODES.MERCHANT_CONFIRMATION);
  assert.equal(normalizeValidationMode("self-checkin"), MODES.MERCHANT_CONFIRMATION);
});
