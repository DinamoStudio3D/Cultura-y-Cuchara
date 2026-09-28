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

function buildPersistencePlan(state, existing = {}, now = null) {
  const progress = existing.progress || null;
  const reward = existing.reward || null;
  const progressData = {
    missionId: state.missionId,
    userId: state.userId,
    current: state.current,
    target: state.target,
    completed: state.completed,
    qualifyingVisitIds: state.qualifyingVisitIds,
    completedAt: state.completed ? (progress?.completedAt || now) : null,
    updatedAt: now
  };

  let rewardAction = "none";
  let rewardData = null;
  if (state.completed && !reward) {
    rewardAction = "create";
    rewardData = {
      missionId: state.missionId,
      userId: state.userId,
      badge: state.mission.badge || null,
      rewardType: state.mission.rewardType || "digital",
      physicalCampaignId: state.mission.physicalCampaignId || null,
      unlockedAt: now,
      source: "chabaquito_mission_v2",
      version: 1
    };
  } else if (!state.completed && reward) {
    rewardAction = "delete";
  }

  return { progressData, rewardAction, rewardData };
}

async function persistMissionState(db, state, now) {
  const progressRef = db.collection("chabaquitoMissionProgress").doc(state.id);
  const rewardRef = db.collection("chabaquitoDigitalRewards").doc(rewardDocumentId(state.userId, state.missionId));

  return db.runTransaction(async tx => {
    const progressSnap = await tx.get(progressRef);
    const rewardSnap = await tx.get(rewardRef);
    const plan = buildPersistencePlan(state, {
      progress: progressSnap.exists ? progressSnap.data() : null,
      reward: rewardSnap.exists ? rewardSnap.data() : null
    }, now);

    tx.set(progressRef, plan.progressData, { merge: true });
    if (plan.rewardAction === "create") tx.create(rewardRef, plan.rewardData);
    if (plan.rewardAction === "delete") tx.delete(rewardRef);
    return plan;
  });
}

async function persistUserMissionStates(db, states, now) {
  const results = [];
  for (const state of states) results.push(await persistMissionState(db, state, now));
  return results;
}

async function calculateUserMissionStatesFromFirestore(db, userId) {
  const safeUserId = cleanId(userId);
  if (!safeUserId) throw new Error("userId es obligatorio.");
  const inputs = await loadMissionInputs(db, safeUserId);
  return calculateUserMissionStates({ userId: safeUserId, ...inputs });
}

module.exports = {
  buildPersistencePlan,
  calculateUserMissionStates,
  calculateUserMissionStatesFromFirestore,
  loadMissionInputs,
  persistMissionState,
  persistUserMissionStates,
  progressDocumentId,
  rewardDocumentId
};
