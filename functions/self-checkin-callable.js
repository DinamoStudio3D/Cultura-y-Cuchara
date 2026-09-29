"use strict";

const { registerSelfCheckin } = require("./self-checkin-service");
const { timingSafeTokenMatch } = require("./self-checkin-token");
const { validateProximity } = require("./self-checkin-proximity");

function requireText(value, name, max = 180) {
  const text = String(value || "").trim();
  if (!text || text.length > max) throw new Error(`${name} inválido.`);
  return text;
}

function createSelfCheckinHandler({ db, Timestamp, safeSyncUserMissionsV2, HttpsError, now = () => new Date() }) {
  if (!db || !Timestamp || !safeSyncUserMissionsV2 || !HttpsError) throw new Error("Dependencias incompletas.");

  return async function selfCheckin(request) {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión para registrar la visita.");

    let placeId, qrToken;
    try {
      placeId = requireText(request.data?.placeId, "Lugar");
      qrToken = requireText(request.data?.qrToken, "Código QR", 500);
    } catch (error) {
      throw new HttpsError("invalid-argument", error.message);
    }

    const [placeSnap, configSnap] = await Promise.all([
      db.collection("locales").doc(placeId).get(),
      db.collection("selfCheckinQrSecrets").doc(placeId).get()
    ]);
    if (!placeSnap.exists) throw new HttpsError("not-found", "El lugar no existe.");
    const place = { id: placeSnap.id, ...placeSnap.data() };
    if (place.validationMode !== "self_checkin") throw new HttpsError("failed-precondition", "Este lugar requiere confirmación de un encargado.");
    if (place.status && place.status !== "published" && place.active === false) throw new HttpsError("failed-precondition", "Este lugar no está disponible para visitas.");

    const secret = configSnap.exists ? configSnap.data() : {};
    if (secret.active === false || !secret.tokenHash || !timingSafeTokenMatch(qrToken, secret.tokenHash)) {
      throw new HttpsError("permission-denied", "El código QR no es válido para este lugar.");
    }

    let proximity;
    try {
      proximity = validateProximity({
        place,
        latitude: request.data?.latitude,
        longitude: request.data?.longitude,
        accuracy: request.data?.accuracy
      });
    } catch (error) {
      throw new HttpsError("failed-precondition", error?.message || "Debes estar cerca del atractivo para registrar la visita.");
    }

    let result;
    try {
      result = await registerSelfCheckin({ deps: { db, Timestamp }, userId: request.auth.uid, place, qrToken, now: now(), proximity });
    } catch (error) {
      throw new HttpsError("failed-precondition", error?.message || "No se pudo registrar la visita.");
    }

    if (!result.alreadyRegistered) await safeSyncUserMissionsV2({ db, userId: request.auth.uid, now: Timestamp.now() });

    return { registered: !result.alreadyRegistered, alreadyRegistered: result.alreadyRegistered, passportAdded: result.passportAdded, visitId: result.visitId, proximity };
  };
}

module.exports = { createSelfCheckinHandler, requireText };
