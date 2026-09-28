'use strict';

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync('js/chabaquito-missions-v2-model.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const model = sandbox.window.visitaLojaChabaquitoMissionsV2;
assert.ok(model, 'El modelo V2 debe exponerse de forma aislada.');
assert.deepStrictEqual(Array.from(model.missionTypes), ['category_visits', 'place_visits', 'canton_visits', 'total_visits']);
assert.deepStrictEqual(Array.from(model.rewardTypes), ['digital', 'digital_physical']);
assert.strictEqual(model.collections.missions, 'chabaquitoMissions');
assert.strictEqual(model.collections.userProgress, 'chabaquitoMissionProgress');
assert.strictEqual(model.collections.userRewards, 'chabaquitoDigitalRewards');

const cafe = model.normalizeMission({
  id: 'cafeterias_10',
  title: 'Explorador cafetero',
  description: 'Visita 10 cafeterías participantes.',
  type: 'category_visits',
  targetCount: 10,
  categoryIds: ['cafeterias'],
  rewardType: 'digital',
  badge: { title: 'Explorador Cafetero', description: 'Completaste la ruta del café.', icon: '☕', rarity: 'rare' },
  status: 'draft'
});
assert.strictEqual(cafe.targetCount, 10);
assert.strictEqual(cafe.rewardType, 'digital');
assert.strictEqual(cafe.physicalCampaignId, null);
assert.strictEqual(cafe.badge.rarity, 'rare');

const physical = model.normalizeMission({
  id: 'restaurantes_10',
  title: 'Sabores de Loja',
  description: 'Visita restaurantes participantes.',
  type: 'place_visits',
  targetCount: 10,
  placeIds: ['lugar_001'],
  rewardType: 'digital_physical',
  physicalCampaignId: 'campana_fisica_01',
  badge: { title: 'Sabores de Loja', description: 'Logro gastronómico.', icon: '🍽️' },
  status: 'active'
});
assert.strictEqual(physical.physicalCampaignId, 'campana_fisica_01');

const progress = model.normalizeProgress({ missionId: cafe.id, userId: 'usuario-demo', current: 10, target: 10, qualifyingVisitIds: ['v1', 'v2'], completedAt: '2026-09-27T12:00:00Z' });
assert.strictEqual(progress.completed, true);

const reward = model.buildDigitalReward({ mission: cafe, userId: 'usuario-demo', unlockedAt: '2026-09-27T12:00:00Z' });
assert.strictEqual(reward.missionId, cafe.id);
assert.strictEqual(reward.badge.title, 'Explorador Cafetero');
assert.strictEqual(reward.source, 'chabaquito_mission_v2');

assert.throws(() => model.normalizeMission({ ...cafe, id: 'x' }), /ID de misión/);
assert.throws(() => model.normalizeMission({ ...cafe, categoryIds: [] }), /categoría/);
assert.throws(() => model.normalizeMission({ ...cafe, targetCount: 0 }), /Meta/);
assert.throws(() => model.normalizeMission({ ...cafe, rewardType: 'physical' }), /recompensa/);

// Protección de arquitectura: esta fase no debe escribir Firestore ni alterar el sistema físico heredado.
assert.doesNotMatch(source, /\.collection\s*\(/, 'El modelo aislado no debe acceder a Firestore.');
assert.doesNotMatch(source, /missionRewardCampaigns['"]\)\.(?:add|set|update|delete)/, 'No debe mutar campañas físicas heredadas.');
assert.match(source, /NO reemplaza missionRewardCampaigns \/ missionRewardClaims/);

console.log('OK Chabaquito Missions V2: modelo digital aislado y compatible con recompensa física opcional.');
