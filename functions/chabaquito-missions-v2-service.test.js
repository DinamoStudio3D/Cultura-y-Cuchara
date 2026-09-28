"use strict";

const assert = require("node:assert/strict");
const {
  calculateUserMissionStates,
  progressDocumentId,
  rewardDocumentId
} = require("./chabaquito-missions-v2-service");

const missions = [
  {
    id: "cafeterias_2",
    status: "active",
    type: "category_visits",
    targetCount: 2,
    categoryIds: ["cafeterias"],
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
  assert.equal(progressDocumentId("user_123", "cafeterias_2"), "user_123_cafeterias_2");
  assert.equal(rewardDocumentId("user_123", "cafeterias_2"), "user_123_cafeterias_2");
}

console.log("Chabaquito Missions V2 service: OK");
