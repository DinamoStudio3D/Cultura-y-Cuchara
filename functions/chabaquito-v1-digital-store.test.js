'use strict';
const assert = require('node:assert/strict');
const { recordDigitalObjective } = require('./chabaquito-v1-digital-store');

const documents = new Map();
function ref(path) {
  return { id: path.split('/').at(-1), path, collection(name) { return collection(`${path}/${name}`); } };
}
function collection(path) { return { doc(id) { return ref(`${path}/${id}`); } }; }
const db = {
  collection,
  async runTransaction(callback) {
    const pending = [];
    const tx = {
      get: async reference => ({ exists: documents.has(reference.path), data: () => documents.get(reference.path) }),
      set: (reference, value, options) => pending.push(() => documents.set(reference.path,
        options?.merge ? { ...documents.get(reference.path), ...value } : value)),
      create: (reference, value) => pending.push(() => { assert.equal(documents.has(reference.path), false); documents.set(reference.path, value); })
    };
    const result = await callback(tx);
    pending.forEach(write => write());
    return result;
  }
};

(async () => {
  const args = { db, uid: 'visitor-1' };
  assert.deepEqual(await recordDigitalObjective({ ...args, objectiveId: 'descubre', answers: [2], now: 1000 }), { passed: false, xp: 0 });
  assert.deepEqual(await recordDigitalObjective({ ...args, objectiveId: 'descubre', answers: [0], now: 1001 }), { passed: true, xp: 50 });
  assert.deepEqual(await recordDigitalObjective({ ...args, objectiveId: 'descubre', answers: [0], now: 1002 }), { alreadyCompleted: true, xp: 50 });
  assert.deepEqual(await recordDigitalObjective({ ...args, objectiveId: 'cultura', answers: [0, 1, 1], now: 1003 }), { passed: true, xp: 100 });
  assert.deepEqual(await recordDigitalObjective({ ...args, objectiveId: 'cultura', answers: [1, 1, 1], now: 1004 }), { alreadyCompleted: true, xp: 100 });
  const profile = documents.get('chabaquitoExplorerProfiles/visitor-1');
  assert.equal(profile.validatedXp, 100);
  assert.equal(profile.level, 1);
  assert.equal([...documents.keys()].filter(path => path.includes('/xpEvents/')).length, 2);
  assert.equal([...documents.keys()].filter(path => path.includes('/xpAudit/')).length, 2);
  console.log('Chabaquito digital persistence: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
