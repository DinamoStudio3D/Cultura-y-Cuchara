'use strict';
const assert = require('node:assert/strict');
const core = require('../js/chabaquito-v1-core');
const persistence = require('./chabaquito-v1-digital-persistence');

const uid = 'user-1';
const first = persistence.planDigitalCompletion({
  uid,
  objectiveId: 'descubre',
  storedEvidence: [],
  storedEvents: [],
  profile: null,
  now: 1000
});
assert.equal(first.evidenceChanged, true);
assert.equal(first.result.xp, 50);
assert.equal(first.profile.validatedXp, 50);
assert.equal(first.profile.level, core.levelForXp(50));
assert.equal(first.delta.grant.length, 1);
assert.equal(first.delta.revoke.length, 0);

const grantedEvents = first.result.xpEvents.map(event => ({ ...event, status: 'granted' }));
const second = persistence.planDigitalCompletion({
  uid,
  objectiveId: 'descubre',
  storedEvidence: [first.evidence],
  storedEvents: grantedEvents,
  profile: first.profile,
  now: 2000
});
assert.equal(second.evidenceChanged, false);
assert.equal(second.profile.validatedXp, 50);
assert.equal(second.delta.grant.length, 0);
assert.equal(second.delta.revoke.length, 0);

assert.throws(() => persistence.planDigitalCompletion({
  uid,
  objectiveId: 'cultura',
  storedEvidence: [],
  storedEvents: [],
  profile: null,
  now: 3000
}), /desbloqueado/);

const cultura = persistence.planDigitalCompletion({
  uid,
  objectiveId: 'cultura',
  storedEvidence: [first.evidence],
  storedEvents: grantedEvents,
  profile: first.profile,
  now: 3000
});
assert.equal(cultura.profile.validatedXp, 100);
assert.equal(cultura.delta.grant.length, 1);
console.log('Chabaquito V1 digital persistence: OK');
