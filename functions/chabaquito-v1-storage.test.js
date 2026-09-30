'use strict';
const assert = require('node:assert/strict');
const core = require('../js/chabaquito-v1-core');
const digital = require('./chabaquito-v1-digital-service');
const confirmed = require('./chabaquito-v1-confirmed-service');
const storage = require('./chabaquito-v1-storage');
class MemoryDb {
  constructor() { this.data = new Map(); this.audit = 0; }
  collection(path) { return new Collection(this, path); }
  async runTransaction(fn) {
    const writes = [];
    const tx = {
      get: async ref => ref instanceof Collection ? { docs: [...this.data].filter(([path]) => path.startsWith(ref.path + '/') && !path.slice(ref.path.length + 1).includes('/'))
        .map(([path, data]) => ({ id: path.split('/').at(-1), data: () => ({ ...data }) })) } :
        { exists: this.data.has(ref.path), data: () => ({ ...this.data.get(ref.path) }) },
      set: (ref, data, options) => writes.push(() => this.data.set(ref.path, options?.merge ? { ...this.data.get(ref.path), ...data } : data)),
      create: (ref, data) => writes.push(() => { assert.equal(this.data.has(ref.path), false); this.data.set(ref.path, data); })
    };
    const result = await fn(tx);
    writes.forEach(write => write());
    return result;
  }
}
class Collection {
  constructor(db, path) { this.db = db; this.path = path; }
  doc(id) { return new Doc(this.db, this.path + '/' + (id || `audit-${++this.db.audit}`)); }
}
class Doc {
  constructor(db, path) { this.db = db; this.path = path; }
  collection(name) { return new Collection(this.db, this.path + '/' + name); }
}

async function run() {
  const db = new MemoryDb(), uid = 'visitor-1', base = `${core.COLLECTIONS.profiles}/${uid}`;
  const complete = (objectiveId, now) => digital.persistDigitalCompletion({ db, authenticatedUid: uid, objectiveId, now });
  await complete('descubre', 1000);
  await complete('cultura', 2000);
  // Compatibilidad: el primer objetivo pudo guardarse con un ID documental antiguo.
  const eventId = `${core.PILOT.id}:descubre`;
  const canonical = `${base}/xpEvents/${storage.documentId(eventId)}`;
  const old = db.data.get(canonical);
  db.data.delete(canonical);
  db.data.set(`${base}/xpEvents/${eventId}`, { ...old, eventId: undefined });
  const evidenceKey = 'digital_objective:pilot_descubre';
  const currentEvidencePath = `${base}/evidence/${storage.documentId(evidenceKey)}`;
  db.data.set(`${base}/evidence/${storage.documentId('digital_objective:descubre')}`, db.data.get(currentEvidencePath));
  db.data.delete(currentEvidencePath);
  const beforeRepeat = JSON.stringify([...db.data]);
  assert.equal((await complete('descubre', 2500)).changed, false);
  assert.equal(JSON.stringify([...db.data]), beforeRepeat, 'Un reintento no escribe ni duplica auditoría.');
  function self(sourceId, proofId, verifiedAt) {
    db.data.set(`${base}/evidence/${storage.documentId(`self_visit:${sourceId}`)}`,
      { type: 'self_visit', sourceId, proofId, status: 'validated', verifiedAt });
  }
  self('point-a', 'pilot_self_one', 3000);
  const visit = { userId: uid, requestId: 'visit-1', placeId: 'place-a', status: 'confirmed', confirmedAt: { toMillis: () => 4000 } };
  const code = { userId: uid, placeId: 'place-a', status: 'confirmed' };
  db.data.set('loyaltyVisits/visit-1', visit);
  db.data.set('visitCodes/visit-1', code);
  const sync = now => confirmed.syncConfirmedVisit({ db, authenticatedUid: uid, visitId: 'visit-1', point: { active: true, placeId: 'place-a' }, now });
  assert.equal((await sync(4500)).xp, 200);
  self('point-c', 'pilot_self_two', 5000);
  assert.equal((await sync(5500)).xp, 500);
  assert.equal(db.data.get(`${base}/adventures/${core.PILOT.id}`).xp, 500);
  assert.equal([...db.data.keys()].filter(k => k.includes('/xpEvents/')).length, 6);
  assert.equal((await complete('descubre', 5600)).xp, 500);
  db.data.set('loyaltyVisits/visit-1', { ...visit, status: 'reversed', reversedAt: { toMillis: () => 6000 } });
  db.data.set('visitCodes/visit-1', { ...code, status: 'reversed' });
  assert.equal((await sync(6500)).xp, 150);
  assert.equal((await complete('descubre', 6600)).xp, 150);
  assert.equal((await sync(6700)).changed, false);
  assert.equal(db.data.get(`${base}/xpEvents/${storage.documentId(`${core.PILOT.id}:completion`)}`).status, 'revoked');
  assert.equal(db.data.get(`${base}/xpEvents/${eventId}`).status, 'granted');
  assert.deepEqual(db.data.get(`${base}/adventures/${core.PILOT.id}`).completedObjectives, ['descubre', 'cultura', 'autonoma-uno']);
  // Fail closed: no elegir arbitrariamente entre dos eventos del mismo objetivo.
  db.data.set(canonical, old);
  const beforeFailure = JSON.stringify([...db.data]);
  await assert.rejects(() => complete('descubre', 7000), /duplicado/);
  assert.equal(JSON.stringify([...db.data]), beforeFailure);
  assert.throws(() => storage.readEvents({ docs: [{ id: 'x', data: () => ({ id: 'a', eventId: 'b' }) }] }), /inconsistente/);
  console.log('Contrato compartido: digital + visita + repetición + legado + reversión OK.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
