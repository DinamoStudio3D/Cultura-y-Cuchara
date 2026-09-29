'use strict';
const assert = require('node:assert/strict');
const core = require('../js/chabaquito-v1-core');
const digital = require('./chabaquito-v1-digital');
const self = require('./chabaquito-v1-self-visit');
const visit = (type, sourceId, proofId, verifiedAt) => ({ type, sourceId, proofId, status: 'validated', verifiedAt });
const one = digital.digitalEvidence({ uid: 'user-1', objectiveId: 'descubre', answers: [0], verifiedAt: 1 });
assert.equal(one.passed, true);
assert.equal(digital.digitalEvidence({ uid: 'user-1', objectiveId: 'descubre', answers: [0], existingEvidence: [one.evidence], verifiedAt: 2 }).alreadyCompleted, true);
assert.equal(digital.validateDigitalAnswer('cultura', [1, 1, null]), true); // 2/3
assert.equal(digital.validateDigitalAnswer('cultura', [1, 0, null]), false); // 1/3
assert.equal(digital.validateDigitalAnswer('cultura', [0, 1, 1]), true); // Ecuador + Sierra
assert.throws(() => digital.digitalEvidence({ uid: 'user-1', objectiveId: 'cultura', answers: [1, 1, null], verifiedAt: 2 }), /bloqueado/);
const two = digital.digitalEvidence({ uid: 'user-1', objectiveId: 'cultura', answers: [1, 1, null], existingEvidence: [one.evidence], verifiedAt: 2 }).evidence;
let evidence = [one.evidence, two];
assert.deepEqual(core.evaluateAdventure(core.PILOT, evidence).availableObjectives, ['autonoma-uno', 'con-encargado']);
const pointA = { id: 'POINT_A', active: true, latitude: -4, longitude: -79.2, radiusMeters: 80, maxAccuracyMeters: 40 };
const markerA = { id: 'pilot_marker_A01', pointId: 'POINT_A', active: true };
const coordinates = { latitude: -4, longitude: -79.2, accuracyMeters: 20 };
const a = self.validateSelfVisit({ uid: 'user-1', marker: markerA, point: pointA, coordinates, existingEvidence: evidence, verifiedAt: 3 });
assert.equal(a.passed, true);
assert.equal('coordinates' in a.evidence, false);
evidence.push(a.evidence);
assert.equal(self.validateSelfVisit({ uid: 'user-1', marker: markerA, point: pointA, coordinates, existingEvidence: evidence, verifiedAt: 4 }).alreadyCompleted, true);
assert.equal(self.validateSelfVisit({ uid: 'user-1', marker: markerA, point: pointA,
  coordinates: { latitude: -3.9, longitude: -79.2, accuracyMeters: 20 }, existingEvidence: [one.evidence, two], verifiedAt: 4 }).passed, false);
assert.equal(self.validateSelfVisit({ uid: 'user-1', marker: markerA, point: pointA,
  coordinates: { ...coordinates, accuracyMeters: 100 }, existingEvidence: [one.evidence, two], verifiedAt: 4 }).passed, false);
assert.throws(() => self.validateSelfVisit({ uid: 'user-1', marker: { ...markerA, active: false }, point: pointA,
  coordinates, existingEvidence: evidence, verifiedAt: 4 }), /no habilitado/);
assert.deepEqual(core.evaluateAdventure(core.PILOT, evidence).availableObjectives, ['con-encargado']);
evidence.push(visit('confirmed_visit', 'visit-B', null, 4));
assert.deepEqual(core.evaluateAdventure(core.PILOT, evidence).availableObjectives, ['autonoma-dos']);
const pointC = { ...pointA, id: 'POINT_C' };
const markerC = { ...markerA, id: 'pilot_marker_C01', pointId: 'POINT_C' };
evidence.push(self.validateSelfVisit({ uid: 'user-1', marker: markerC, point: pointC, coordinates, existingEvidence: evidence, verifiedAt: 5 }).evidence);
assert.equal(core.evaluateAdventure(core.PILOT, evidence).xp, 500);
assert.deepEqual(core.evaluateAdventure(core.PILOT, evidence).badgeIds, [core.PILOT.badge.id]);
assert.equal(core.evaluateAdventure(core.PILOT, [...evidence, { ...evidence[3], status: 'reversed', verifiedAt: 6 }]).xp, 150);
assert.equal(core.levelForXp(500), 2);
const publicEntry = core.publicRankingEntry({ publicAlias: 'ChabaquitoFan', participateInRanking: true,
  validatedXp: 500, publicBadgeIds: ['amigo-de-chabaquito', 'other', 'third', 'fourth'],
  email: 'secret@example.com', phone: 'private', uid: 'private', coordinates });
assert.deepEqual(Object.keys(publicEntry).sort(), ['alias', 'avatar', 'badgeIds', 'level', 'xp']);
assert.equal(publicEntry.badgeIds.length, 3);
assert.equal(core.publicRankingEntry({ publicAlias: 'Anon', participateInRanking: false, validatedXp: 500 }), null);
console.log('Chabaquito V1 pilot: OK');
