'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { processValidatedVisit } = require('./chabaquito-v1-visit-validation');
class Db {
  constructor() { this.data = new Map(); this.version = 0; this.serial = 0; this.retries = 0; }
  collection(path) { return new Collection(this, path); }
  async runTransaction(fn) {
    for (let retry = 0; retry < 50; retry++) {
      const version = this.version, snapshot = new Map(this.data), writes = [];
      const result = await fn({
        get: async ref => ref instanceof Collection ? { docs: [...snapshot].filter(([p]) => p.startsWith(ref.path + '/') && !p.slice(ref.path.length + 1).includes('/')).map(([p, data]) => ({ id: p.split('/').at(-1), data: () => structuredClone(data) })).filter(d => !ref.predicate || ref.predicate(d.data())) } : { exists: snapshot.has(ref.path), data: () => structuredClone(snapshot.get(ref.path)) },
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
class Collection { constructor(db, path) { this.db = db; this.path = path; } where(field, op, value) { if (op !== 'array-contains') throw new Error('Unsupported query'); const q = new Collection(this.db, this.path); q.predicate = data => Array.isArray(data[field]) && data[field].includes(value); return q; } doc(id) { return new Doc(this.db, `${this.path}/${id || `audit-${++this.db.serial}`}`); } }
class Doc { constructor(db, path) { this.db = db; this.path = path; } collection(name) { return new Collection(this.db, `${this.path}/${name}`); } }

function setup(mode = 'both') {
  const db = new Db();
  db.data.set('locales/place-a', { active: true, validationMode: mode, cantonId: 'saraguro', lat: -3.6, lng: -79.2, discovery: { enabled: true, qrId: 'qr-a' } });
  db.data.set('qrCodes/qr-a', { active: true, discoveryEnabled: true, placeId: 'place-a' });
  db.data.set('missionRewardMerchants/staff-a', { active: true, placeIds: ['place-a'] });
  db.data.set('loyaltyVisits/visit-a', { requestId: 'visit-a', userId: 'user-a', placeId: 'place-a', status: 'confirmed', confirmedBy: 'staff-a', confirmedAt: 1000 });
  db.data.set('visitCodes/visit-a', { userId: 'user-a', placeId: 'place-a', status: 'confirmed', confirmedBy: 'staff-a', confirmedAt: 1000, expiresAt: 1500 });
  const common = { db, authenticatedUid: 'user-a', now: 2000 };
  const coordinates = { latitude: -3.6, longitude: -79.2, accuracy: 20, capturedAt: 2000 };
  return { db, coordinates,
    staff: extra => processValidatedVisit({ ...common, method: 'staff', visitId: 'visit-a', ...extra }),
    self: extra => processValidatedVisit({ ...common, method: 'proximity', qrId: 'qr-a', coordinates, ...extra }) };
}
test('encargado asignado válido, otra parada rechazado', async () => {
  const s = setup('merchant_confirmation'); assert.equal((await s.staff()).xpDelta, 70);
  const bad = setup(); bad.db.data.set('missionRewardMerchants/staff-a', { active: true, placeIds: ['place-b'] });
  await assert.rejects(bad.staff(), /no autorizado|incompleta/);
});
test('propietario/encargado y acceso suspendido', async () => {
  for (const role of ['owner', 'encargado']) { const s = setup(); s.db.data.set('missionRewardMerchants/staff-a', { active: true, placeIds: ['place-a'], role }); assert.equal((await s.staff()).xpDelta, 70); }
  const s = setup(); s.db.data.set('missionRewardMerchants/staff-a', { active: false, placeIds: ['place-a'] }); await assert.rejects(s.staff(), /no autorizado|incompleta/);
});
test('≤15m válido; >15m rechazado sin ampliar por accuracy', async () => {
  const s = setup('self_checkin'); assert.equal((await s.self({ coordinates: { ...s.coordinates, latitude: -3.6 + 14 / 111195 } })).xpDelta, 70);
  const b = setup(); await assert.rejects(b.self({ coordinates: { ...b.coordinates, latitude: -3.6 + 16 / 111195 } }), /Fuera/);
});
test('accuracy >20, cero, NaN y lectura antigua rechazados', async () => {
  for (const patch of [{ accuracy: 21 }, { accuracy: 0 }, { accuracy: NaN }, { capturedAt: -40000 }]) {
    const s = setup(); await assert.rejects(s.self({ coordinates: { ...s.coordinates, ...patch } }), /GPS/);
  }
});
test('both admite cada método y juntos no duplican XP en ambos órdenes', async () => {
  for (const order of [['staff', 'self'], ['self', 'staff']]) {
    const s = setup(); assert.equal((await s[order[0]]()).xpDelta, 70); assert.equal((await s[order[1]]()).xpDelta, 0);
    assert.equal((await s[order[0]]()).xpDelta, 0);
  }
  const s = setup(); const r = await Promise.all([s.staff(), s.self()]); assert.equal(r.reduce((sum, x) => sum + x.xpDelta, 0), 70); assert.ok(s.db.retries > 0);
});
test('modo incompatible, parada/QR deshabilitado y asociación incorrecta rechazados', async () => {
  await assert.rejects(setup('self_checkin').staff(), /incompatible/);
  await assert.rejects(setup('merchant_confirmation').self(), /no permitido/);
  for (const patch of [{ discoveryEnabled: false }, { active: false }, { placeId: 'place-b' }]) {
    const s = setup(); Object.assign(s.db.data.get('qrCodes/qr-a'), patch); await assert.rejects(s.self());
  }
  for (const patch of [{ active: false }, { discovery: { enabled: false } }, { cantonId: undefined }, { validationMode: 'unknown' }]) {
    const s = setup(); Object.assign(s.db.data.get('locales/place-a'), patch); await assert.rejects(s.self());
  }
});
test('cliente no cambia parada, cantón, coordenadas oficiales, UID o XP', async () => {
  const s = setup(); assert.equal((await s.self({ placeId: 'place-b', cantonId: 'loja', lat: 0, lng: 0, xp: 10000 })).xpDelta, 70);
  const b = setup(); await assert.rejects(b.staff({ authenticatedUid: 'other' }), /incompatible/);
  const far = setup(); await assert.rejects(far.self({ lat: 0, lng: 0, coordinates: { ...far.coordinates, latitude: 0, longitude: 0 } }), /Fuera/);
});
test('confirmación caducada, actor incoherente y pendiente rechazados', async () => {
  for (const patch of [{ expiresAt: 500 }, { confirmedBy: 'staff-b' }, { status: 'pending' }, { confirmedAt: 900 }]) {
    const s = setup(); Object.assign(s.db.data.get('visitCodes/visit-a'), patch); await assert.rejects(s.staff());
  }
});
test('reversión real de la fuente conserva evidencia y auditoría', async () => {
  const s = setup(); await s.staff();
  Object.assign(s.db.data.get('visitCodes/visit-a'), { status: 'reversed' });
  Object.assign(s.db.data.get('loyaltyVisits/visit-a'), { status: 'reversed', reversedAt: 3000 }); s.db.version++;
  assert.equal((await s.staff({ now: 4000 })).xpDelta, -70); assert.equal((await s.staff({ now: 4000 })).xpDelta, 0);
});
