"use strict";

const crypto = require("node:crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
const REGION = "us-central1";

function cleanId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 180);
}

function requireString(value, name, max = 180) {
  const result = String(value || "").trim();
  if (!result || result.length > max) throw new HttpsError("invalid-argument", `${name} inválido.`);
  return result;
}

function ecuadorDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(date);
}

function rewardCode() {
  return `FID-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function authorizedMerchant(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  const ref = db.collection("missionRewardMerchants").doc(request.auth.uid);
  const snap = await ref.get();
  const merchant = snap.exists ? snap.data() : null;
  if (!merchant || merchant.active === false) throw new HttpsError("permission-denied", "Cuenta de negocio no autorizada.");
  return { uid: request.auth.uid, email: request.auth.token.email || "", ...merchant };
}

function auditRef() {
  return db.collection("systemAudit").doc();
}

exports.confirmLoyaltyVisit = onCall({ region: REGION, enforceAppCheck: false }, async request => {
  const merchant = await authorizedMerchant(request);
  const requestId = requireString(request.data?.requestId, "Código de visita");
  const amountRaw = Number(request.data?.purchaseAmount || 0);
  const purchaseAmount = Number.isFinite(amountRaw) ? Math.max(0, Math.min(100000, Math.round(amountRaw * 100) / 100)) : 0;
  const receiptRef = String(request.data?.receiptRef || "").trim().slice(0, 80);
  const codeRef = db.collection("visitCodes").doc(requestId);

  return db.runTransaction(async tx => {
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists) throw new HttpsError("not-found", "El código no existe.");
    const code = codeSnap.data();
    if (code.status !== "pending" || !code.expiresAt || code.expiresAt.toMillis() < Date.now()) throw new HttpsError("failed-precondition", "El código venció o ya fue utilizado.");
    if (!(merchant.placeIds || []).includes(code.placeId)) throw new HttpsError("permission-denied", "Este negocio no puede confirmar esta parada.");

    const programRef = db.collection("loyaltyPrograms").doc(code.placeId);
    const passportRef = db.collection("siteContent").doc("passport");
    const counterId = cleanId(`${code.userId}_${code.placeId}`);
    const counterRef = db.collection("loyaltyCounters").doc(counterId);
    const visitRef = db.collection("loyaltyVisits").doc(requestId);
    const [programSnap, passportSnap, counterSnap, visitSnap] = await Promise.all([
      tx.get(programRef), tx.get(passportRef), tx.get(counterRef), tx.get(visitRef)
    ]);
    if (visitSnap.exists) throw new HttpsError("already-exists", "La visita ya fue registrada.");

    const program = programSnap.exists ? programSnap.data() : null;
    const passport = passportSnap.exists ? passportSnap.data() : {};
    const counter = counterSnap.exists ? counterSnap.data() : null;
    const campaignId = passport.campaignId || "pasaporte-general";
    const stampId = cleanId(`${campaignId}_${code.userId}_${code.placeId}`);
    const stampRef = db.collection("securePassportStamps").doc(stampId);
    const stampSnap = await tx.get(stampRef);
    const today = ecuadorDay();
    const maxDaily = Math.max(1, Math.min(3, Number(program?.maxVisitsPerDay || 1)));
    const previousDaily = counter?.lastVisitDay === today ? Number(counter.dailyVisitCount || 0) : 0;
    if (previousDaily >= maxDaily) throw new HttpsError("resource-exhausted", "El cliente alcanzó el máximo diario.");

    const now = Timestamp.now();
    const newCount = Number(counter?.visitCount || 0) + 1;
    const target = Math.max(10, Number(program?.targetVisits || 10));
    const oldCycles = Number(counter?.rewardCycles || 0);
    const newCycle = Math.floor(newCount / target);
    const earned = Boolean(program && program.active !== false && newCycle > oldCycles);
    const claimed = Number(program?.claimedCount || 0);
    const stockAvailable = program?.stock == null || claimed < Number(program.stock);
    const rewardId = cleanId(`${code.userId}_${code.placeId}_${newCycle}`);
    const rewardRef = earned && stockAvailable ? db.collection("loyaltyRewardClaims").doc(rewardId) : null;

    tx.update(codeRef, { status: "confirmed", confirmedAt: now, confirmedBy: merchant.uid, confirmedByName: merchant.businessName || merchant.email, passportAdded: !stampSnap.exists, updatedAt: now });
    tx.create(visitRef, { requestId, userId: code.userId, userName: code.userName || "", userEmail: code.userEmail || "", placeId: code.placeId, placeName: code.placeName || "", confirmedBy: merchant.uid, confirmedByName: merchant.businessName || "", confirmedAt: now, passportAdded: !stampSnap.exists, purchaseAmount, receiptRef, status: "confirmed", previousVisitCount: Number(counter?.visitCount || 0), previousRewardCycles: oldCycles, previousTotalSpend: Number(counter?.totalSpend || 0), previousDailyVisitCount: previousDaily, previousLastVisitDay: counter?.lastVisitDay || "", previousLastVisitAt: counter?.lastVisitAt || null, previousLastVisitRequestId: counter?.lastVisitRequestId || "", passportStampId: !stampSnap.exists ? stampId : "", rewardClaimId: rewardRef ? rewardId : "" });
    const counterData = { visitorType: code.visitorType || "", city: code.city || "", birthMonthDay: code.birthMonthDay || "", visitCount: newCount, rewardCycles: rewardRef ? newCycle : oldCycles, lastVisitDay: today, dailyVisitCount: previousDaily + 1, lastVisitRequestId: requestId, lastVisitAt: now, totalSpend: Number(counter?.totalSpend || 0) + purchaseAmount, updatedAt: now };
    if (counter) tx.set(counterRef, counterData, { merge: true });
    else tx.create(counterRef, { userId: code.userId, userName: code.userName || "", userEmail: code.userEmail || "", placeId: code.placeId, placeName: code.placeName || "", ...counterData, firstVisitAt: now });
    if (!stampSnap.exists) tx.create(stampRef, { requestId, campaignId, userId: code.userId, placeId: code.placeId, placeName: code.placeName || "", confirmedBy: merchant.uid, confirmedAt: now });
    if (rewardRef) {
      tx.create(rewardRef, { userId: code.userId, userName: code.userName || "", userEmail: code.userEmail || "", placeId: code.placeId, placeName: code.placeName || "", programId: code.placeId, cycle: newCycle, rewardTitle: program.rewardTitle || "Beneficio de fidelidad", rewardDescription: program.rewardDescription || "", claimCode: rewardCode(), status: "pending", createdAt: now, expiresAt: Timestamp.fromMillis(now.toMillis() + Number(program.rewardValidityDays || 30) * 86400000) });
      tx.update(programRef, { claimedCount: FieldValue.increment(1), updatedAt: now });
    }
    tx.create(auditRef(), { action: "loyalty_stamp_added", actorUid: merchant.uid, actorEmail: merchant.email, actorName: merchant.businessName || "", userId: code.userId, placeId: code.placeId, requestId, purchaseAmount, receiptRef, createdAt: now });
    return { visitCount: newCount, target, passportAdded: !stampSnap.exists, rewardCreated: Boolean(rewardRef) };
  });
});

exports.reverseLastLoyaltyVisit = onCall({ region: REGION, enforceAppCheck: false }, async request => {
  const merchant = await authorizedMerchant(request);
  const requestId = requireString(request.data?.requestId, "Visita");
  const visitRef = db.collection("loyaltyVisits").doc(requestId);
  return db.runTransaction(async tx => {
    const visitSnap = await tx.get(visitRef);
    if (!visitSnap.exists) throw new HttpsError("not-found", "La visita no existe.");
    const visit = visitSnap.data();
    if (visit.status !== "confirmed" || visit.confirmedBy !== merchant.uid) throw new HttpsError("permission-denied", "Solo puede anularla quien la confirmó.");
    if (!(merchant.placeIds || []).includes(visit.placeId)) throw new HttpsError("permission-denied", "Parada no autorizada.");
    if (!visit.confirmedAt || Date.now() > visit.confirmedAt.toMillis() + 15 * 60000) throw new HttpsError("deadline-exceeded", "El plazo para deshacer el sello terminó.");
    const counterId = cleanId(`${visit.userId}_${visit.placeId}`);
    const counterRef = db.collection("loyaltyCounters").doc(counterId);
    const programRef = db.collection("loyaltyPrograms").doc(visit.placeId);
    const counterSnap = await tx.get(counterRef);
    const programSnap = await tx.get(programRef);
    if (!counterSnap.exists || counterSnap.data().lastVisitRequestId !== requestId) throw new HttpsError("failed-precondition", "Solo puede deshacerse el último sello.");
    const stampRef = visit.passportStampId ? db.collection("securePassportStamps").doc(visit.passportStampId) : null;
    const rewardRef = visit.rewardClaimId ? db.collection("loyaltyRewardClaims").doc(visit.rewardClaimId) : null;
    const rewardSnap = rewardRef ? await tx.get(rewardRef) : null;
    if (rewardSnap?.exists && rewardSnap.data().status !== "pending") throw new HttpsError("failed-precondition", "El premio generado ya fue entregado.");
    const now = Timestamp.now();
    tx.update(visitRef, { status: "reversed", reversedAt: now, reversedBy: merchant.uid });
    tx.set(counterRef, { visitCount: Math.max(0, Number(visit.previousVisitCount || 0)), rewardCycles: Math.max(0, Number(visit.previousRewardCycles || 0)), totalSpend: Math.max(0, Number(visit.previousTotalSpend || 0)), dailyVisitCount: Math.max(0, Number(visit.previousDailyVisitCount || 0)), lastVisitDay: visit.previousLastVisitDay || "", lastVisitAt: visit.previousLastVisitAt || visit.confirmedAt, lastVisitRequestId: visit.previousLastVisitRequestId || "", updatedAt: now }, { merge: true });
    if (stampRef) tx.delete(stampRef);
    if (rewardRef && rewardSnap?.exists) { tx.delete(rewardRef); if (programSnap.exists) tx.update(programRef, { claimedCount: FieldValue.increment(-1), updatedAt: now }); }
    tx.create(auditRef(), { action: "loyalty_stamp_reversed", actorUid: merchant.uid, actorEmail: merchant.email, actorName: merchant.businessName || "", userId: visit.userId, placeId: visit.placeId, requestId, purchaseAmount: Number(visit.purchaseAmount || 0), receiptRef: visit.receiptRef || "", createdAt: now });
    return { visitCount: Math.max(0, Number(visit.previousVisitCount || 0)), target: Math.max(10, Number(programSnap.data()?.targetVisits || 10)) };
  });
});

exports.deliverRewardSecurely = onCall({ region: REGION, enforceAppCheck: false }, async request => {
  const merchant = await authorizedMerchant(request);
  const type = requireString(request.data?.type, "Tipo", 20);
  const claimId = requireString(request.data?.claimId, "Premio");
  const config = {
    loyalty: { collection: "loyaltyRewardClaims", time: "deliveredAt", actor: "deliveredBy" },
    passport: { collection: "passportCompletions", time: "deliveredAt", actor: "deliveredBy" },
    mission: { collection: "missionRewardClaims", time: "processedAt", actor: "processedBy" }
  }[type];
  if (!config) throw new HttpsError("invalid-argument", "Tipo de premio inválido.");
  const ref = db.collection(config.collection).doc(claimId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().status !== "pending") throw new HttpsError("failed-precondition", "El premio ya no está disponible.");
    const claim = snap.data();
    const authorized = type === "loyalty" ? (merchant.placeIds || []).includes(claim.placeId)
      : type === "passport" ? (merchant.passportGrants || []).includes(`${claim.campaignId}:${claim.mode}`)
      : (merchant.campaignIds || []).includes(claim.campaignId);
    if (!authorized) throw new HttpsError("permission-denied", "No tienes permiso para entregar este premio.");
    const now = Timestamp.now();
    tx.update(ref, { status: "delivered", [config.time]: now, [config.actor]: type === "loyalty" ? merchant.uid : merchant.email, ...(type === "loyalty" ? { updatedAt: now } : {}) });
    tx.create(auditRef(), { action: `${type}_reward_delivered`, actorUid: merchant.uid, actorEmail: merchant.email, actorName: merchant.businessName || "", userId: claim.userId || "", placeId: claim.placeId || "", claimId, claimCode: claim.claimCode || "", createdAt: now });
    return { delivered: true };
  });
});
