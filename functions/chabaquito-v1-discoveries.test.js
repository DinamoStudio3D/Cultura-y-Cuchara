'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { processDiscovery } = require('./chabaquito-v1-discoveries');
const core = require('../js/chabaquito-v1-core');
const storage = require('./chabaquito-v1-storage');
// Optimistic transaction simulator: conflict detection + full callback retry.
// Not a replacement for the Firestore emulator.
class Db {
  constructor() { this.data = new Map(); this.version = 0; this.serial = 0; this.retries = 0; }
  collection(path) { return new Collection(this, path); }
  async runTransaction(fn) {
    for (let retry = 0; retry < 50; retry++) {
      const version = this.version, snapshot = new Map(this.data), writes = [];
      const result = await fn({
        get: async ref => ref instanceof Collection ? { docs: [...snapshot].filter(([p]) => p.startsWith(ref.path + '/') && !p.slice(ref.path.length + 1).includes('/')).map(([p, data]) => ({ id: p.split('/').at(-1), data: () => structuredClone(data) })) } : { exists: snapshot.has(ref.path), data: () => structuredClone(snapshot.get(ref.path)) },
        set: (ref, data, options) => writes.push([ref.path, data, !!options?.merge, false]),
        create: (ref, data) => writes.push([ref.path, data, false, true])
      });
      if (version !== this.version) { this.retries++; continue; }
      for (const [p, , , create] of writes) if (create && this.data.has(p)) throw new Error('Duplicate create');
      for (const [p, data, merge] of writes) this.data.set(p, structuredClone(merge ? { ...this.data.get(p), ...data } : data));
      if (writes.length) this.version++;
      return result;
    }
    throw new Error('Transaction retries exhausted');
  }
}
class Collection { constructor(db, path) { this.db = db; this.path = path; } doc(id) { return new Doc(this.db, `${this.path}/${id || `audit-${++this.db.serial}`}`); } }
class Doc { constructor(db, path) { this.db = db; this.path = path; } collection(name) { return new Collection(this.db, `${this.path}/${name}`); } }
function setup() {
  const db = new Db();
  function source(id, overrides = {}) {
    db.data.set(`trustedSources/${id}`, { userId: 'user-a', sourceId: id, type: 'confirmed_visit', placeId: 'place-x', cantonId: null, status: 'validated', verifiedAt: 1000, validationMethod: 'staff_confirmation', ...overrides }); db.version++;
  }
  function run(id = 'visit-1', uid = 'user-a', extra = {}) {
    return processDiscovery({ db, authenticatedUid: uid, evidenceId: id, now: 2000,
      loadValidatedEvidence: async ({ tx, evidenceId }) => { const s = await tx.get(db.collection('trustedSources').doc(evidenceId)); return s.exists ? s.data() : null; }, ...extra });
  }
  const base = uid => `${core.COLLECTIONS.profiles}/${uid}`;
  const events = uid => [...db.data].filter(([p]) => p.startsWith(`${base(uid)}/xpEvents/`));
  return { db, source, run, base, events };
}
test('A primera parada +20', async () => { const s = setup(); s.source('visit-1'); assert.equal((await s.run()).xpDelta, 20); });
test('B diez repeticiones +0 y un evento', async () => { const s = setup(); s.source('visit-1'); await s.run(); for (let i = 0; i < 10; i++) assert.equal((await s.run()).xpDelta, 0); assert.equal(s.events('user-a').length, 1); });
test('C primera parada de Saraguro +70', async () => { const s = setup(); s.source('visit-1', { cantonId: 'saraguro' }); assert.equal((await s.run()).xpDelta, 70); });
test('D segunda parada del mismo cantón +20', async () => { const s = setup(); s.source('visit-1', { cantonId: 'saraguro' }); await s.run(); s.source('visit-2', { cantonId: 'saraguro', placeId: 'place-y' }); assert.equal((await s.run('visit-2')).xpDelta, 20); });
test('E inválida rechazada sin XP ni escrituras', async () => { const s = setup(); s.source('visit-1', { status: 'pending' }); const before = [...s.db.data]; await assert.rejects(s.run(), /no válida/); assert.deepEqual([...s.db.data], before); assert.equal(s.events('user-a').length, 0); });
test('F usuarios independientes y UID ajeno rechazado', async () => { const s = setup(); s.source('visit-1'); s.source('visit-2', { userId: 'user-b' }); assert.equal((await s.run()).xpDelta, 20); assert.equal((await s.run('visit-2', 'user-b')).xpDelta, 20); await assert.rejects(s.run('visit-1', 'user-b'), /no válida/); });
test('G diez concurrentes: un grant con reintento', async () => { const s = setup(); s.source('visit-1', { cantonId: 'saraguro' }); const results = await Promise.all(Array.from({ length: 10 }, () => s.run())); assert.equal(results.filter(r => r.xpDelta > 0).length, 1); assert.equal(results.reduce((sum, r) => sum + r.xpDelta, 0), 70); assert.equal(s.events('user-a').length, 2); assert.ok(s.db.retries > 0); });
test('H XP del cliente/evidencia ignorado', async () => { const s = setup(); s.source('visit-1', { xp: 10000 }); assert.equal((await s.run('visit-1', 'user-a', { xp: 10000 })).xpDelta, 20); });
test('I reintento no modifica perfil ni auditoría', async () => { const s = setup(); s.source('visit-1'); await s.run(); const before = [...s.db.data]; assert.equal((await s.run()).changed, false); assert.deepEqual([...s.db.data], before); });
test('J reversión auditable única, saldo correcto', async () => { const s = setup(); s.source('visit-1', { cantonId: 'saraguro' }); await s.run(); s.source('visit-1', { cantonId: 'saraguro', status: 'reversed', verifiedAt: 3000 }); const r = await s.run(); assert.equal(r.xpDelta, -70); assert.equal(r.validatedXp, 0); assert.equal((await s.run()).xpDelta, 0); assert.ok(s.events('user-a').every(([, e]) => e.status === 'revoked')); assert.equal([...s.db.data.keys()].filter(p => p.includes('/xpAudit/')).length, 2); });
test('check-in y otra visita misma parada no dan XP adicional; otra evidencia sostiene descubrimiento', async () => { const s = setup(); s.source('visit-1', { cantonId: 'saraguro' }); await s.run(); s.source('visit-2', { cantonId: 'saraguro', validationMethod: 'checkin' }); assert.equal((await s.run('visit-2')).xpDelta, 0); s.source('visit-1', { cantonId: 'saraguro', status: 'reversed', verifiedAt: 3000 }); assert.equal((await s.run()).validatedXp, 70); s.source('visit-2', { cantonId: 'saraguro', status: 'reversed', verifiedAt: 3000, validationMethod: 'checkin' }); assert.equal((await s.run('visit-2')).validatedXp, 0); });
test('concurrencia entre paradas distintas del mismo cantón y saldo piloto conservado', async () => { const s = setup(); s.db.data.set(s.base('user-a'), { validatedXp: 50, publicBadgeIds: ['demo'] }); s.source('visit-1', { cantonId: 'saraguro' }); s.source('visit-2', { cantonId: 'saraguro', placeId: 'place-y' }); const r = await Promise.all([s.run(), s.run('visit-2')]); assert.equal(r.reduce((sum, e) => sum + e.xpDelta, 0), 90); assert.equal(s.db.data.get(s.base('user-a')).validatedXp, 140); assert.deepEqual(s.db.data.get(s.base('user-a')).publicBadgeIds, ['demo']); assert.equal(s.db.data.get(`${s.base('user-a')}/xpEvents/${storage.documentId('discovery:canton:saraguro')}`).xp, 50); });

test('evidencia turística no activa XP adicional del piloto', () => {
  const input = [
    { type: 'digital_objective', sourceId: 'd1', proofId: 'pilot_discover', status: 'validated', verifiedAt: 1000 },
    { type: 'digital_objective', sourceId: 'd2', proofId: 'pilot_culture', status: 'validated', verifiedAt: 2000 },
    { type: 'confirmed_visit', sourceId: 'visit-1', proofId: null, status: 'validated', verifiedAt: 3000, scope: 'tourism_discovery' }
  ];
  assert.equal(core.evaluateAdventure(core.PILOT, input).xp, 100);
  assert.ok(!core.evaluateAdventure(core.PILOT, input).completedObjectives.includes('con-encargado'));
});

test('servicio piloto no sobrescribe una evidencia turística', () => {
  const { planConfirmedVisit } = require('./chabaquito-v1-confirmed-service');
  assert.throws(() => planConfirmedVisit({ uid: 'user-a', visitId: 'visit-1',
    point: { active: true, placeId: 'place-x' }, now: 2000,
    visit: { userId: 'user-a', requestId: 'visit-1', placeId: 'place-x', status: 'confirmed', confirmedAt: { toMillis: () => 1000 } },
    code: { userId: 'user-a', placeId: 'place-x', status: 'confirmed' },
    storedEvidence: [{ type: 'confirmed_visit', sourceId: 'visit-1', placeId: 'place-x', status: 'validated', verifiedAt: 1000, scope: 'tourism_discovery' }]
  }), /no puede reutilizarla/);
});
