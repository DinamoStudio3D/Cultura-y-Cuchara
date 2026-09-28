"use strict";

// Capa backend aislada para Misiones de Chabaquito V2.
// Lee únicamente fuentes confiables de Firestore mediante Admin SDK.
// No está conectada todavía a confirmLoyaltyVisit ni reverseLastLoyaltyVisit.

const { calculateMissionProgress } = require("./chabaquito-missions-v2-engine");

function cleanId(value) {
  return String(value ?? "").trim();
}

function progressDocumentId(userId, missionId) {
  const user = cleanId(userId);
  const mission = cleanId(missionId);
  if (!user || !mission) throw new Error("userId y missionId son obligatorios.");
  return `${user}_${mission}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 300);
}

function rewardDocumentId(userId, missionId) {
  return progressDocumentId(userId, missionId);
}

function missionFromSnapshot(doc) {
  return { id: doc.id, ...doc.data() };
}

function visitFromSnapshot(doc) {
  return { requestId: doc.id, ...doc.data() };
}

function placeFromSnapshot(doc) {
  return { id: doc.id, ...doc.data() };
}

async function loadMissionInputs(db, userId) {
  const [missionsSnap, visitsSnap, placesSnap] = await Promise.all([
    db.collection("chabaquitoMissions").where("status", "==", "active").get(),
    db.collection("loyaltyVisits").where("userId", "==", userId).get(),
    db.collection("locales").get()
  ]);

  const missions = missionsSnap.docs.map(missionFromSnapshot);
  const visits = visitsSnap.docs.map(visitFromSnapshot);
  const placesById = Object.fromEntries(placesSnap.docs.map(doc => [doc.id, placeFromSnapshot(doc)]));
  return { missions, visits, placesById };
}

function calculateUserMissionStates({ userId, missions, visits, placesById }) {
  return missions.map(mission => {
    const progress = calculateMissionProgress(mission, visits, placesById);
    return {
      id: progressDocumentId(userId, mission.id),
      missionId: mission.id,
      userId,
      current: progress.count,
      target: progress.target,
      completed: progress.completed,
      qualifyingVisitIds: progress.matchedKeys,
      mission,
      sourceVisitCount: progress.sourceVisitCount
    };
  });
}

async function calculateUserMissionStatesFromFirestore(db, userId) {
  const safeUserId = cleanId(userId);
  if (!safeUserId) throw new Error("userId es obligatorio.");
  const inputs = await loadMissionInputs(db, safeUserId);
  return calculateUserMissionStates({ userId: safeUserId, ...inputs });
}

module.exports = {
  calculateUserMissionStates,
  calculateUserMissionStatesFromFirestore,
  loadMissionInputs,
  progressDocumentId,
  rewardDocumentId
};
