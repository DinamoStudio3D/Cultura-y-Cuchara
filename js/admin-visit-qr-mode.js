"use strict";

(function (root) {
  const visitApi = root.VisitaLojaVisitValidationAdmin;
  const FALLBACK_MODE = "merchant_confirmation";
  const SELF_CHECKIN_MODE = "self_checkin";

  function normalizeMode(value) {
    if (visitApi?.normalizeAdminVisitValidationMode) return visitApi.normalizeAdminVisitValidationMode(value);
    return value === SELF_CHECKIN_MODE ? SELF_CHECKIN_MODE : FALLBACK_MODE;
  }

  function visitQrMeta(place = {}) {
    const mode = normalizeMode(place.validationMode);
    const selfCheckin = mode === SELF_CHECKIN_MODE;
    return Object.freeze({
      mode,
      selfCheckin,
      requiresMerchantConfirmation: !selfCheckin,
      loyaltyAllowed: !selfCheckin,
      purpose: selfCheckin ? "visit_self_checkin" : "visit_merchant_confirmation",
      label: selfCheckin ? "QR de visita sin encargado" : "QR de visita con encargado",
      description: selfCheckin
        ? "Este QR identifica una visita autogestionada para Pasaporte/Misiones. No concede sellos de fidelidad comercial."
        : "Este QR mantiene la confirmación por personal autorizado y puede participar en Fidelidad cuando corresponda."
    });
  }

  function buildVisitQrDescriptor(place = {}, placeId = "") {
    const meta = visitQrMeta(place);
    const id = String(placeId || place.id || "").trim();
    if (!id) throw new Error("placeId es obligatorio para preparar un QR de visita.");
    return Object.freeze({
      placeId: id,
      validationMode: meta.mode,
      purpose: meta.purpose,
      requiresMerchantConfirmation: meta.requiresMerchantConfirmation,
      loyaltyAllowed: meta.loyaltyAllowed
    });
  }

  root.VisitaLojaVisitQrMode = Object.freeze({ visitQrMeta, buildVisitQrDescriptor });
})(typeof window !== "undefined" ? window : globalThis);
