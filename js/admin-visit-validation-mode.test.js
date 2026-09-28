"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const adminModes = require("./admin-visit-validation-mode");

test("lugares antiguos conservan confirmación por encargado", () => {
  assert.equal(adminModes.validationModeForPlace({}), adminModes.MODES.MERCHANT_CONFIRMATION);
  assert.equal(adminModes.validationModeRequiresMerchant(undefined), true);
  assert.equal(adminModes.validationModeSupportsLoyalty(undefined), true);
});

test("self_checkin se reconoce sin habilitar fidelidad comercial", () => {
  const meta = adminModes.validationModeUiMeta(adminModes.MODES.SELF_CHECKIN);
  assert.equal(meta.mode, adminModes.MODES.SELF_CHECKIN);
  assert.equal(meta.merchantRequired, false);
  assert.equal(meta.selfCheckinEnabled, true);
  assert.equal(meta.loyaltyEnabled, false);
  assert.equal(adminModes.validationModeSupportsLoyalty(adminModes.MODES.SELF_CHECKIN), false);
});

test("valores desconocidos vuelven al modo seguro", () => {
  assert.equal(adminModes.isAdminVisitValidationMode("inventado"), false);
  assert.deepEqual(adminModes.validationModePatch("inventado"), {
    validationMode: adminModes.MODES.MERCHANT_CONFIRMATION
  });
});
