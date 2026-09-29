'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const auth = { currentUser: { uid: 'visitor-1', getIdToken: async () => 'test-token' } };
let requests = [];
const window = { firebase: { apps: [{ name: 'viveLojaPublic', auth: () => auth }] } };
vm.runInNewContext(fs.readFileSync('js/chabaquito-v1-persistent.js', 'utf8'), {
  window, document: { getElementById: () => null },
  fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ ok: true, passed: true, xp: 50 }) }; }
});
(async () => {
  const client = window.ChabaquitoV1Persistent;
  assert.equal(client.getState().authenticated, true, 'Reuse existing named Firebase auth, not a missing window.visitorAuth');
  assert.equal(requests.length, 0, 'Loading the module must not save a demo answer');
  const result = await client.completeFirstObjective([0]);
  assert.equal(result.xp, 50);
  assert.equal(requests[0].url, '/api/chabaquito-v1-objective');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(requests[0].options.body), { adventureId: 'tras-las-huellas-de-chabaquito', objectiveId: 'descubre', answers: [0] });
  auth.currentUser = null;
  assert.equal(client.getState().authenticated, false);
  assert.equal((await client.completeFirstObjective([0])).code, 'AUTH_REQUIRED');
  assert.equal(requests.length, 1, 'Signed-out user cannot save');
  assert.equal((await client.completeFirstObjective([500])).code, 'INVALID_ANSWERS');
  assert.equal(requests.length, 1);
  console.log('Chabaquito persistent client: named auth, explicit save only, server payload and logout OK.');
})().catch(error => { console.error(error); process.exitCode = 1; });
