'use strict';
const assert = require('node:assert/strict');
const { createHandler } = require('./chabaquito-v1-objective');
let reads = 0;
const progress = { xp: 50, completedObjectives: ['descubre'] };
const db = { collection: () => ({ doc: () => ({
  get: async () => { reads++; return { exists: true, data: () => ({ validatedXp: 50 }) }; },
  collection: () => ({ doc: () => ({ get: async () => { reads++; return { exists: true, data: () => progress }; } }) })
}) }) };
const fetchImpl = async () => ({ ok: true, json: async () => ({ users: [{ localId: 'visitor-1' }] }) });
async function call(handler, method, authorization, body) {
  let status, payload;
  await handler({ method, headers: { authorization }, body }, {
    setHeader() {}, status(value) { status = value; return this; }, json(value) { payload = value; return this; }
  });
  return { status, payload };
}
(async () => {
  const disabled = createHandler({ env: {}, fetchImpl, dbFactory: () => { throw new Error('No database access while disabled'); } });
  assert.equal((await call(disabled, 'GET', 'Bearer test')).status, 503);
  const handler = createHandler({ env: { CHABAQUITO_V1_ENABLED: 'true', VERCEL_ENV: 'production' }, fetchImpl, dbFactory: () => db });
  assert.equal((await call(handler, 'GET')).status, 401);
  assert.equal(reads, 0);
  const first = await call(handler, 'GET', 'Bearer test');
  assert.equal(first.status, 200);
  assert.equal(first.payload.xp, 50);
  assert.equal(first.payload.level, 1);
  assert.deepEqual(first.payload.completedObjectives, ['descubre']);
  assert.equal(reads, 2);
  assert.deepEqual(await call(handler, 'GET', 'Bearer test'), first);
  assert.equal((await call(handler, 'POST', 'Bearer test', { adventureId: 'fake', objectiveId: 'descubre', answers: [0], xp: 500 })).status, 400);
  assert.equal((await call(handler, 'POST', 'Bearer test', { adventureId: 'tras-las-huellas-de-chabaquito', objectiveId: 'descubre', answers: [2], xp: 500 })).payload.passed, false);
  assert.equal(reads, 4, 'Incorrect answers never read or write progress');
  const denied = createHandler({ env: { CHABAQUITO_V1_ENABLED: 'true', VERCEL_ENV: 'production' }, fetchImpl: async () => ({ ok: false }), dbFactory: () => { throw new Error('Invalid token must not read database'); } });
  assert.equal((await call(denied, 'GET', 'Bearer invalid')).status, 401);
  console.log('Chabaquito first objective API: authenticated read, reload, invalid input and disabled mode OK (mock database only).');
})().catch(error => { console.error(error); process.exitCode = 1; });
