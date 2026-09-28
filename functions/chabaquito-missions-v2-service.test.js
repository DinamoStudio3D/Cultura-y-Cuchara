"use strict";

const assert = require("node:assert/strict");
const {
  buildPersistencePlan,
  calculateUserMissionStates,
  persistMissionState,
  progressDocumentId,
  rewardDocumentId,
  safeSyncUserMissionsV2
} = require("./chabaquito-missions-v2-service");

const missions = [
  {
    id: "cafeterias_2",
    status: "active",
    type: "category_visits",
    targetCount: 2,
    categoryIds: ["cafeterias"],
    badge: { title: "Explorador cafetero", rarity: "rare" },
    rewardType: "digital",
    startsAt: "2026-09-01T00:00:00-05:00",
    endsAt: "2026-10-01T00:00:00-05:00"
  }
];
const placesById = {
  cafe1: { id: "cafe1", category: "cafeterias", canton: "Loja" },
  cafe2: { id: "cafe2", category: "cafeterias", canton: "Catamayo" }
};
const visit = (requestId, placeId, status = "confirmed") => ({
  requestId,
  placeId,
  status,
  confirmedAt: "2026-09-15T12:00:00-05:00"
});

function createFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  const ref = (collection, id) => ({ key: `${collection}/${id}` });
  return {
    store,
    collection(name) {
      return { doc: id => ref(name, id) };
    },
    async runTransaction(callback) {
      const tx = {
        async get(docRef) {
          const exists = store.has(docRef.key);
          return { exists, data: () => store.get(docRef.key) };
        },
        set(docRef, data, options = {}) {
          const previous = store.get(docRef.key) || {};
          store.set(docRef.key, options.merge ? { ...previous, ...data } : { ...data });
        },
        create(docRef, data) {
          if (store.has(docRef.key)) throw new Error(`Documento ya existe: ${docRef.key}`);
          store.set(docRef.key, { ...data });
        },
        delete(docRef) {
          store.delete(docRef.key);
        }
      };
      return callback(tx);
    }
  };
}

{
  const states = calculateUserMissionStates({
    userId: "user_123",
    missions,
    visits: [visit("visit_a", "cafe1"), visit("visit_b", "cafe2")],
    placesById
  });
  assert.equal(states.length, 1);
  assert.equal(states[0].current, 2);
  assert.equal(states[0].completed, true);
  assert.equal(states[0].userId, "user_123");
  assert.equal(states[0].missionId, "cafeterias_2");
}

{
  const before = calculateUserMissionStates({
    userId: "user_123",
    missions,
    visits: [visit("visit_a", "cafe1"), visit("visit_b", "cafe2")],
    placesById
  });
  const after = calculateUserMissionStates({
    userId: "user_123",
    missions,
    visits: [visit("visit_a", "cafe1"), visit("visit_b", "cafe2", "reversed")],
    placesById
  });
  assert.equal(before[0].completed, true);
  assert.equal(after[0].completed, false);
  assert.equal(after[0].current, 1);
}

{
  const state = calculateUserMissionStates({
    userId: "user_123",
    missions,
    visits: [visit("visit_a", "cafe1"), visit("visit_b", "cafe2")],
    placesById
  })[0];
  const now = "2026-09-15T17:00:00.000Z";
  const plan = buildPersistencePlan(state, {}, now);
  assert.equal(plan.progressData.completed, true);
  assert.equal(plan.progressData.completedAt, now);
  assert.equal(plan.rewardAction, "create");
  assert.equal(plan.rewardData.badge.title, "Explorador cafetero");
}

{
  const state = calculateUserMissionStates({
    userId: "user_123",
    missions,
    visits: [visit("visit_a", "cafe1"), visit("visit_b", "cafe2")],
    placesById
  })[0];
  const originalCompletedAt = "2026-09-14T17:00:00.000Z";
  const plan = buildPersistencePlan(state, {
    progress: { completedAt: originalCompletedAt },
    reward: { missionId: "cafeterias_2" }
  }, "2026-09-15T17:00:00.000Z");
  assert.equal(plan.progressData.completedAt, originalCompletedAt);
  assert.equal(plan.rewardAction, "none");
}

{
  const state = calculateUserMissionStates({
    userId: "user_123",
    missions,
    visits: [visit("visit_a", "cafe1"), visit("visit_b", "cafe2", "reversed")],
    placesById
  })[0];
  const plan = buildPersistencePlan(state, {
    progress: { completedAt: "2026-09-14T17:00:00.000Z" },
    reward: { missionId: "cafeterias_2" }
  }, "2026-09-15T17:00:00.000Z");
  assert.equal(plan.progressData.completed, false);
  assert.equal(plan.progressData.completedAt, null);
  assert.equal(plan.rewardAction, "delete");
}

(async () => {
  const now = "2026-09-15T17:00:00.000Z";
  const completedState = calculateUserMissionStates({
    userId: "user_123",
    missions,
    visits: [visit("visit_a", "cafe1"), visit("visit_b", "cafe2")],
    placesById
  })[0];
  const db = createFakeDb();

  const first = await persistMissionState(db, completedState, now);
  assert.equal(first.rewardAction, "create");
  assert.equal(db.store.get("chabaquitoMissionProgress/user_123_cafeterias_2").completed, true);
  assert.equal(db.store.get("chabaquitoDigitalRewards/user_123_cafeterias_2").badge.title, "Explorador cafetero");

  const second = await persistMissionState(db, completedState, "2026-09-16T17:00:00.000Z");
  assert.equal(second.rewardAction, "none");
  assert.equal(db.store.get("chabaquitoMissionProgress/user_123_cafeterias_2").completedAt, now);

  const reversedState = calculateUserMissionStates({
    userId: "user_123",
    missions,
    visits: [visit("visit_a", "cafe1"), visit("visit_b", "cafe2", "reversed")],
    placesById
  })[0];
  const reversed = await persistMissionState(db, reversedState, "2026-09-16T18:00:00.000Z");
  assert.equal(reversed.rewardAction, "delete");
  assert.equal(db.store.get("chabaquitoMissionProgress/user_123_cafeterias_2").completed, false);
  assert.equal(db.store.has("chabaquitoDigitalRewards/user_123_cafeterias_2"), false);

  const logged = [];
  const safeFailure = await safeSyncUserMissionsV2({
    db: {
      collection() {
        throw new Error("fallo simulado de Firestore");
      }
    },
    userId: "user_123",
    now,
    logger: { error: (...args) => logged.push(args) }
  });
  assert.equal(safeFailure.ok, false);
  assert.equal(safeFailure.error, "fallo simulado de Firestore");
  assert.equal(logged.length, 1);

  assert.equal(progressDocumentId("user_123", "cafeterias_2"), "user_123_cafeterias_2");
  assert.equal(rewardDocumentId("user_123", "cafeterias_2"), "user_123_cafeterias_2");
  console.log("Chabaquito Missions V2 service: OK");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
