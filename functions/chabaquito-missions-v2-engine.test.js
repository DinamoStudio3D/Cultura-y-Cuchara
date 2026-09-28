"use strict";

const assert = require("node:assert/strict");
const { calculateMissionProgress } = require("./chabaquito-missions-v2-engine");

const places = {
  cafe1: { category: "cafeterias", canton: "Loja" },
  cafe2: { category: "cafeterias", canton: "Catamayo" },
  rest1: { category: "restaurantes", canton: "Loja" }
};
const visit = (requestId, placeId, confirmedAt, status = "confirmed") => ({ requestId, placeId, confirmedAt, status });
const base = { status: "active", targetCount: 2, startsAt: "2026-09-01T00:00:00-05:00", endsAt: "2026-10-01T00:00:00-05:00" };

{
  const result = calculateMissionProgress({ ...base, type: "category_visits", categoryIds: ["cafeterias"] }, [
    visit("a", "cafe1", "2026-09-10T10:00:00-05:00"),
    visit("b", "cafe1", "2026-09-11T10:00:00-05:00"),
    visit("c", "cafe2", "2026-09-12T10:00:00-05:00"),
    visit("d", "rest1", "2026-09-13T10:00:00-05:00")
  ], places);
  assert.equal(result.count, 2);
  assert.equal(result.completed, true);
  assert.deepEqual(result.matchedKeys.sort(), ["cafe1", "cafe2"]);
}

{
  const result = calculateMissionProgress({ ...base, type: "place_visits", placeIds: ["cafe1", "rest1"] }, [
    visit("a", "cafe1", "2026-09-10T10:00:00-05:00"),
    visit("b", "cafe1", "2026-09-11T10:00:00-05:00"),
    visit("c", "rest1", "2026-09-12T10:00:00-05:00", "reversed")
  ], places);
  assert.equal(result.count, 1);
  assert.equal(result.completed, false);
}

{
  const result = calculateMissionProgress({ ...base, type: "canton_visits", cantonIds: ["Loja", "Catamayo"] }, [
    visit("a", "cafe1", "2026-09-10T10:00:00-05:00"),
    visit("b", "rest1", "2026-09-11T10:00:00-05:00"),
    visit("c", "cafe2", "2026-09-12T10:00:00-05:00")
  ], places);
  assert.equal(result.count, 2);
  assert.equal(result.completed, true);
}

{
  const result = calculateMissionProgress({ ...base, type: "total_visits", targetCount: 3 }, [
    visit("a", "cafe1", "2026-09-10T10:00:00-05:00"),
    visit("b", "cafe1", "2026-09-11T10:00:00-05:00"),
    visit("c", "cafe1", "2026-09-12T10:00:00-05:00"),
    visit("d", "cafe2", "2026-08-12T10:00:00-05:00")
  ], places);
  assert.equal(result.count, 3);
  assert.equal(result.completed, true);
}

{
  const result = calculateMissionProgress({ ...base, status: "paused", type: "total_visits" }, [visit("a", "cafe1", "2026-09-10T10:00:00-05:00")], places);
  assert.equal(result.count, 0);
}

// Una visita que completaba la misión deja de contar al ser revertida.
{
  const mission = { ...base, type: "place_visits", placeIds: ["cafe1", "rest1"] };
  const beforeReverse = calculateMissionProgress(mission, [
    visit("a", "cafe1", "2026-09-10T10:00:00-05:00"),
    visit("b", "rest1", "2026-09-11T10:00:00-05:00")
  ], places);
  const afterReverse = calculateMissionProgress(mission, [
    visit("a", "cafe1", "2026-09-10T10:00:00-05:00"),
    visit("b", "rest1", "2026-09-11T10:00:00-05:00", "reversed")
  ], places);
  assert.equal(beforeReverse.count, 2);
  assert.equal(beforeReverse.completed, true);
  assert.equal(afterReverse.count, 1);
  assert.equal(afterReverse.completed, false);
  assert.deepEqual(afterReverse.matchedKeys, ["cafe1"]);
}

// Recalcular dos veces sobre la misma fuente confirmada produce el mismo resultado.
{
  const mission = { ...base, type: "category_visits", categoryIds: ["cafeterias"] };
  const visits = [
    visit("a", "cafe1", "2026-09-10T10:00:00-05:00"),
    visit("b", "cafe2", "2026-09-11T10:00:00-05:00")
  ];
  const first = calculateMissionProgress(mission, visits, places);
  const second = calculateMissionProgress(mission, visits, places);
  assert.deepEqual(second, first);
}

// Visitas fuera de vigencia no pueden acreditar progreso, ni antes ni después de la campaña.
{
  const result = calculateMissionProgress({ ...base, type: "total_visits", targetCount: 1 }, [
    visit("before", "cafe1", "2026-08-31T23:59:59-05:00"),
    visit("after", "cafe1", "2026-10-01T00:00:01-05:00")
  ], places);
  assert.equal(result.count, 0);
  assert.equal(result.completed, false);
}

// Una visita sin fecha confirmada válida nunca debe contar.
{
  const result = calculateMissionProgress({ ...base, type: "total_visits", targetCount: 1 }, [
    visit("bad-date", "cafe1", "fecha-invalida")
  ], places);
  assert.equal(result.count, 0);
  assert.equal(result.completed, false);
}

console.log("Chabaquito Missions V2 engine: OK");
