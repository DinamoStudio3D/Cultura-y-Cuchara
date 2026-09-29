"use strict";

const crypto = require("node:crypto");

function cleanId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 180);
}

function ecuadorDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(date);
}

function selfCheckinId({ userId, placeId, day }) {
  return cleanId(`self_${userId}_${placeId}_${day}`);
}

function passportStampId({ campaignId, userId, placeId }) {
  return cleanId(`${campaignId}_${userId}_${placeId}`);
}

function qrFingerprint(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

/**
 * Registra una visita autónoma sin tocar fidelidad comercial.
 * deps debe aportar db, Timestamp y FieldValue compatibles con firebase-admin.
 */
async function registerSelfCheckin({ deps, userId, place, qrToken = "", now = new Date() }) {
  const { db, Timestamp } = deps || {};
  if (!db || !Timestamp) throw new Error("Dependencias de self-checkin incompletas.");
  if (!userId) throw new Error("Usuario requerido.");
  if (!place?.id) throw new Error("Lugar requerido.");
  if (place.validationMode !== "self_checkin") throw new Error("Este lugar requiere validación de encargado.");

  const day = ecuadorDay(now);
  const visitId = selfCheckinId({ userId, placeId: place.id, day });
  const visitRef = db.collection("selfCheckinVisits").doc(visitId);
  const passportRef = db.collection("siteContent").doc("passport");

  return db.runTransaction(async tx => {
    const [visitSnap, passportSnap] = await Promise.all([tx.get(visitRef), tx.get(passportRef)]);
    if (visitSnap.exists) return { alreadyRegistered: true, visitId, passportAdded: false };

    const passport = passportSnap.exists ? passportSnap.data() : {};
    const campaignId = passport.campaignId || "pasaporte-general";
    const stampId = passportStampId({ campaignId, userId, placeId: place.id });
    const stampRef = db.collection("securePassportStamps").doc(stampId);
    const stampSnap = await tx.get(stampRef);
    const createdAt = Timestamp.fromDate ? Timestamp.fromDate(now) : Timestamp.now();

    tx.create(visitRef, {
      userId,
      placeId: place.id,
      placeName: place.name || "",
      validationMode: "self_checkin",
      day,
      qrFingerprint: qrFingerprint(qrToken),
      passportStampId: stampSnap.exists ? "" : stampId,
      createdAt
    });

    if (!stampSnap.exists) {
      tx.create(stampRef, {
        requestId: visitId,
        campaignId,
        userId,
        placeId: place.id,
        placeName: place.name || "",
        validationMode: "self_checkin",
        confirmedBy: "self_checkin",
        confirmedAt: createdAt
      });
    }

    return { alreadyRegistered: false, visitId, passportAdded: !stampSnap.exists };
  });
}

module.exports = { cleanId, ecuadorDay, selfCheckinId, passportStampId, qrFingerprint, registerSelfCheckin };
