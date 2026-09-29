'use strict';
const assert = require('node:assert/strict');
const core = require('./chabaquito-v1-core');
const pilot = core.PILOT;
const visit = (type, sourceId, proofId, status = 'validated', verifiedAt = 1) => ({ type, sourceId, proofId, status, verifiedAt });
const all = [
  visit('digital_objective', 'digital-a', 'pilot_discover'),
  visit('digital_objective', 'digital-b', 'pilot_culture'),
  visit('self_visit', 'qr-a-claim', 'pilot_self_one'),
  visit('confirmed_visit', 'visit-existing-1', null),
  visit('self_visit', 'qr-b-claim', 'pilot_self_two')
];
assert.deepEqual(core.evaluateAdventure(pilot, []).completedObjectives, []);
assert.equal(core.evaluateAdventure(pilot, all).xp, 500);
assert.equal(core.evaluateAdventure(pilot, all).xpEvents.length, 6);
assert.deepEqual(core.evaluateAdventure(pilot, all).badgeIds, ['amigo-de-chabaquito']);
assert.equal(core.evaluateAdventure(pilot, [...all, all[3], all[3]]).xp, 500);
assert.equal(core.evaluateAdventure(pilot, [...all.slice(0, 3), all[2], all[4]]).xp, 150);
assert.equal(core.evaluateAdventure(pilot, [...all, visit('confirmed_visit', 'visit-existing-1', null, 'reversed', 2)]).xp, 150);
assert.equal(core.evaluateAdventure(pilot, [...all, visit('confirmed_visit', 'visit-existing-1', null, 'reversed', 1)]).xp, 150);
assert.equal(core.evaluateAdventure(pilot, [...all, visit('confirmed_visit', 'visit-existing-1', null, 'reversed', 2), visit('confirmed_visit', 'visit-existing-2', null)]).xp, 500);
const oldEvents = core.evaluateAdventure(pilot, all).xpEvents;
assert.deepEqual(core.reconcileXp(oldEvents, oldEvents), { grant: [], revoke: [] });
const undone = core.reconcileXp(oldEvents, core.evaluateAdventure(pilot, [...all, visit('confirmed_visit', 'visit-existing-1', null, 'reversed', 2)]).xpEvents);
assert.deepEqual(undone.revoke.map(e => e.id), [`${pilot.id}:con-encargado`, `${pilot.id}:autonoma-dos`, `${pilot.id}:completion`]);
assert.equal(core.levelForXp(500), 2);
assert.equal(core.LEVELS[1].name, 'Caminante de Loja');
assert.deepEqual(core.evaluateAdventure(pilot, []).availableObjectives, ['descubre']);
assert.deepEqual(core.evaluateAdventure(pilot, all.slice(0, 2)).availableObjectives, ['autonoma-uno', 'con-encargado']);
assert.deepEqual(core.evaluateAdventure(pilot, all.slice(0, 4)).availableObjectives, ['autonoma-dos']);
assert.equal(core.evaluateAdventure(pilot, [all[0], { ...all[1], verifiedAt: 3 }, { ...all[2], verifiedAt: 2 }]).xp, 100);
assert.equal(core.publicRankingEntry({ publicAlias: 'Exploradora', validatedXp: 500, participateInRanking: true, email: 'private@test', uid: 'secret' }).email, undefined);
assert.equal(core.publicRankingEntry({ publicAlias: 'Exploradora', validatedXp: 500, participateInRanking: false }), null);
assert.throws(() => core.normalizeEvidence({ type: 'self_visit', sourceId: 'a', status: 'validated', verifiedAt: 1 }), /objetivo/i);
console.log('Chabaquito V1 core: OK');
