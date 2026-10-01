"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
const REGION = "us-central1";

function cleanId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 360);
}

exports.registerSelfCheckinVisit = onCall({ region: REGION, enforceAppCheck: false }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const placeId = String(request.data?.placeId || "").trim();
  if (!placeId || placeId.length > 180) throw new HttpsError("invalid-argument", "Parada inválida.");

  const placeRef = db.collection("locales").doc(placeId);
  const visitId = cleanId(`${request.auth.uid}_${placeId}`);
  const visitRef = db.collection("selfCheckinVisits").doc(visitId);

  return db.runTransaction(async tx => {
    const [placeSnap, visitSnap] = await Promise.all([tx.get(placeRef), tx.get(visitRef)]);
    if (!placeSnap.exists) throw new HttpsError("not-found", "La parada no existe.");

    const place = placeSnap.data() || {};
    if (place.validationMode !== "self_checkin") {
      throw new HttpsError("failed-precondition", "Esta parada requiere otro método de validación.");
    }
    if (place.status && !["published", "active"].includes(place.status)) {
      throw new HttpsError("failed-precondition", "La parada no está publicada.");
    }

    if (visitSnap.exists) {
      return { registered: true, alreadyRegistered: true, visitId };
    }

    const now = Timestamp.now();
    tx.create(visitRef, {
      visitId,
      userId: request.auth.uid,
      userName: String(request.auth.token.name || "").slice(0, 100),
      userEmail: String(request.auth.token.email || "").slice(0, 320),
      placeId,
      placeName: String(place.title || place.name || "Parada Visita Loja").slice(0, 160),
      purpose: "passport_missions",
      status: "confirmed",
      source: "self_checkin_qr",
      createdAt: now
    });

    return { registered: true, alreadyRegistered: false, visitId };
  });
});
