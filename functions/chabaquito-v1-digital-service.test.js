'use strict';
const assert = require('node:assert/strict');
const service = require('./chabaquito-v1-digital-service');
const core = require('../js/chabaquito-v1-core');

class MemoryDb {
  constructor() { this.data = new Map(); }
  collection(path) { return new Collection(this, path); }
  async runTransaction(fn) {
    const writes = [];
    const tx = {
      get: async ref => ref instanceof Collection ? { docs: [...this.data].filter(([path]) => path.startsWith(ref.path + '/') && !path.slice(ref.path.length + 1).includes('/')).map(([path, data]) => ({ id: path.split('/').at(-1), data: () => ({ ...data }) })) } : { exists: this.data.has(ref.path), data: () => ({ ...this.data.get(ref.path) }) },
      set: (ref, data, options) => writes.push(() => this.data.set(ref.path, options?.merge ? { ...this.data.get(ref.path), ...data } : data)),
      create: (ref, data) => writes.push(() => { assert.equal(this.data.has(ref.path), false); this.data.set(ref.path, data); })
    };
    const result = await fn(tx); writes.forEach(write => write()); return result;
  }
}
class Collection { constructor(db, path) { this.db = db; this.path = path; } doc(id) { return new Doc(this.db, this.path + '/' + id); } }
class Doc { constructor(db, path) { this.db = db; this.path = path; } collection(name) { return new Collection(this.db, this.path + '/' + name); } }

async function run() {
  const db = new MemoryDb();
  const uid = 'visitor-1';
  const complete = now => service.persistDigitalCompletion({ db, authenticatedUid: uid, objectiveId: 'descubre', now });
  const first = await complete(1000);
  assert.equal(first.changed, true);
  assert.equal(first.xp, 50);
  assert.deepEqual(first.completedObjectives, ['descubre']);
  const second = await complete(2000);
  assert.equal(second.changed, false);
  assert.equal(second.xp, 50);
  assert.equal([...db.data.keys()].filter(key => key.includes('/xpEvents/')).length, 1);
  assert.equal(db.data.get(`${core.COLLECTIONS.profiles}/${uid}`).validatedXp, 50);
  assert.equal(db.data.get(`${core.COLLECTIONS.profiles}/${uid}/adventures/${core.PILOT.id}`).xp, 50);
  await assert.rejects(() => service.persistDigitalCompletion({ db: new MemoryDb(), authenticatedUid: uid, objectiveId: 'cultura', now: 3000 }), /desbloqueado/);
  console.log('Chabaquito V1 digital service: OK');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
