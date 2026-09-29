'use strict';
const assert = require('node:assert/strict');
const service = require('./chabaquito-v1-confirmed-service');
const core = require('../js/chabaquito-v1-core');

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
const date = value => ({ toMillis: () => value });
async function run() {
  const db = new MemoryDb();
  const uid = 'visitor-1';
  const id = 'visit-1';
  const point = { active: true, placeId: 'place-a' };
  const visit = { userId: uid, requestId: id, placeId: 'place-a', status: 'confirmed', confirmedAt: date(1000) };
  const code = { userId: uid, placeId: 'place-a', status: 'confirmed' };
  db.data.set(`loyaltyVisits/${id}`, visit);
  db.data.set(`visitCodes/${id}`, code);
  const sync = () => service.syncConfirmedVisit({ db, authenticatedUid: uid, visitId: id, point, now: 2000 });
  await assert.rejects(() => service.syncConfirmedVisit({ db, authenticatedUid: uid, visitId: id, now: 2000 }), /pendiente de configurar/);
  assert.deepEqual(await sync(), { changed: true, xp: 0 });
  assert.deepEqual(await sync(), { changed: false, xp: 0 });
  assert.equal([...db.data.keys()].filter(key => key.includes('/xpAudit/')).length, 1);
  await assert.rejects(() => service.syncConfirmedVisit({ db, authenticatedUid: 'other', visitId: id, point }), /incompatibles/);
  db.data.set(`loyaltyVisits/${id}`, { ...visit, status: 'reversed', reversedAt: date(3000) });
  db.data.set(`visitCodes/${id}`, { ...code, status: 'reversed' });
  assert.deepEqual(await sync(), { changed: true, xp: 0 });
  assert.deepEqual(await sync(), { changed: false, xp: 0 });
  assert.equal([...db.data.keys()].filter(key => key.includes('/xpAudit/')).length, 2);
  const evidence = db.data.get(`${core.COLLECTIONS.profiles}/${uid}/evidence/${service.documentId('confirmed_visit:visit-1')}`);
  assert.equal(evidence.status, 'reversed');
  assert.equal(db.data.get(`${core.COLLECTIONS.profiles}/${uid}`).validatedXp, 0);
  db.data.set(`loyaltyVisits/${id}`, visit);
  db.data.set(`visitCodes/${id}`, code);
  await assert.rejects(sync, /anulada previamente/);
  assert.deepEqual(db.data.get(`loyaltyVisits/${id}`), visit);
  assert.equal(db.data.get(`visitCodes/${id}`).status, 'confirmed');

  const full = new MemoryDb();
  full.data.set(`loyaltyVisits/${id}`, visit);
  full.data.set(`visitCodes/${id}`, code);
  const others = [
    ['digital_objective', 'digital-1', 'pilot_discover'],
    ['digital_objective', 'digital-2', 'pilot_culture'],
    ['self_visit', 'self-1', 'pilot_self_one'],
    ['self_visit', 'self-2', 'pilot_self_two']
  ];
  for (const [type, sourceId, proofId] of others) {
    full.data.set(`${core.COLLECTIONS.profiles}/${uid}/evidence/${service.documentId(`${type}:${sourceId}`)}`,
      { type, sourceId, proofId, status: 'validated', verifiedAt: sourceId === 'self-2' ? 1200 : 500 });
  }
  const fullSync = () => service.syncConfirmedVisit({ db: full, authenticatedUid: uid, visitId: id, point, now: 2000 });
  assert.deepEqual(await fullSync(), { changed: true, xp: 500 });
  assert.deepEqual(full.data.get(`${core.COLLECTIONS.profiles}/${uid}`).publicBadgeIds, [core.PILOT.badge.id]);
  full.data.set(`loyaltyVisits/${id}`, { ...visit, status: 'reversed', reversedAt: date(3000) });
  full.data.set(`visitCodes/${id}`, { ...code, status: 'reversed' });
  assert.deepEqual(await fullSync(), { changed: true, xp: 150 });
  assert.deepEqual(full.data.get(`${core.COLLECTIONS.profiles}/${uid}`).publicBadgeIds, []);
  assert.equal(full.data.get(`${core.COLLECTIONS.profiles}/${uid}/xpEvents/${service.documentId(`${core.PILOT.id}:completion`)}`).status, 'revoked');
  console.log('Chabaquito V1 confirmed visit service: OK');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
