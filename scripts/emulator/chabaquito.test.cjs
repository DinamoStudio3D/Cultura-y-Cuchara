'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Fail before importing an SDK unless explicitly pointed at our local demo emulator.
const projectId = 'demo-visitaloja-chabaquito';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8787') throw new Error('Solo se permite el emulador local 127.0.0.1:8787.');
if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('Retira credenciales reales antes de ejecutar estas pruebas.');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc, writeBatch, serverTimestamp } = require('firebase/firestore');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { processValidatedVisit } = require('../../functions/chabaquito-v1-visit-validation');
const core = require('../../js/chabaquito-v1-core');

let env, app, db;
const base = `${core.COLLECTIONS.profiles}/user-a`;
async function seed(mode = 'both') {
  await env.clearFirestore();
  const batch = db.batch();
  batch.set(db.doc('locales/place-a'), { active: true, validationMode: mode, cantonId: 'saraguro', lat: -3.6, lng: -79.2, discovery: { enabled: true, qrId: 'qr-a' } });
  batch.set(db.doc('qrCodes/qr-a'), { active: true, discoveryEnabled: true, placeId: 'place-a' });
  batch.set(db.doc('missionRewardMerchants/staff-a'), { active: true, placeIds: ['place-a'] });
  batch.set(db.doc('missionRewardMerchants/staff-b'), { active: true, placeIds: ['place-b'] });
  batch.set(db.doc('visitCodes/visit-a'), { userId: 'user-a', placeId: 'place-a', status: 'pending', createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 60000) });
  await batch.commit();
}
async function confirm() {
  const client = env.authenticatedContext('staff-a').firestore();
  const batch = writeBatch(client), timestamp = serverTimestamp();
  batch.update(doc(client, 'visitCodes/visit-a'), { status: 'confirmed', confirmedBy: 'staff-a', confirmedAt: timestamp, updatedAt: timestamp });
  batch.set(doc(client, 'loyaltyVisits/visit-a'), { requestId: 'visit-a', userId: 'user-a', placeId: 'place-a', status: 'confirmed', confirmedBy: 'staff-a', confirmedAt: timestamp });
  batch.set(doc(client, 'loyaltyCounters/user-a_place-a'), { userId: 'user-a', placeId: 'place-a', visitCount: 1, rewardCycles: 0, dailyVisitCount: 1, lastVisitRequestId: 'visit-a', lastVisitAt: timestamp, updatedAt: timestamp });
  batch.set(doc(client, 'securePassportStamps/stamp-a'), { requestId: 'visit-a', userId: 'user-a', placeId: 'place-a', confirmedBy: 'staff-a', confirmedAt: timestamp });
  await assertSucceeds(batch.commit());
}
function staff() { return processValidatedVisit({ db, authenticatedUid: 'user-a', method: 'staff', visitId: 'visit-a' }); }
function self() { const now = Date.now(); return processValidatedVisit({ db, authenticatedUid: 'user-a', method: 'proximity', qrId: 'qr-a', coordinates: { latitude: -3.6, longitude: -79.2, accuracy: 10, capturedAt: now }, now }); }

test('Chabaquito contra Firestore Emulator y reglas del repositorio', async t => {
  env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8787, rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') } });
  app = initializeApp({ projectId }, 'chabaquito-emulator-test');
  db = getFirestore(app);
  try {
    await t.test('cliente no puede escribir XP, evidencia, eventos ni leer perfil ajeno', async () => {
      await seed();
      for (const uid of ['user-a', 'staff-a']) {
        const client = env.authenticatedContext(uid).firestore();
        for (const suffix of ['', '/xpEvents/forged', '/evidence/forged', '/adventures/forged']) await assertFails(setDoc(doc(client, base + suffix), { validatedXp: 10000 }));
        await assertFails(getDoc(doc(client, base)));
      }
      await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), base), { validatedXp: 10000 }));
    });
    await t.test('encargado A confirma A; encargado B no puede confirmar A', async () => {
      await seed();
      const other = env.authenticatedContext('staff-b').firestore();
      await assertFails(updateDoc(doc(other, 'visitCodes/visit-a'), { status: 'confirmed', confirmedBy: 'staff-b', confirmedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
      await confirm();
      assert.equal((await staff()).xpDelta, 70);
    });
    await t.test('diez transacciones concurrentes conceden solo70XP', async () => {
      await seed(); await confirm();
      const results = await Promise.all(Array.from({ length: 10 }, staff));
      assert.equal(results.reduce((sum, r) => sum + r.xpDelta, 0), 70);
      assert.equal(results.filter(r => r.changed).length, 1);
      assert.equal((await db.doc(base).get()).data().validatedXp, 70);
      assert.equal((await db.collection(`${base}/xpEvents`).get()).size, 2);
      assert.equal((await db.collection(`${base}/xpAudit`).get()).size, 1);
    });
    await t.test('ambos métodos concurrentes: un descubrimiento, sin dobleXP', async () => {
      await seed(); await confirm();
      const results = await Promise.all([staff(), self()]);
      assert.equal(results.reduce((sum, r) => sum + r.xpDelta, 0), 70);
      assert.equal((await db.doc(base).get()).data().validatedXp, 70);
      assert.equal((await db.collection(`${base}/xpEvents`).get()).size, 2);
    });
    await t.test('reversión conserva auditoría y no se aplica dos veces', async () => {
      await seed(); await confirm(); await staff();
      const now = Date.now();
      const batch = db.batch();
      batch.update(db.doc('visitCodes/visit-a'), { status: 'reversed', reversedAt: now });
      batch.update(db.doc('loyaltyVisits/visit-a'), { status: 'reversed', reversedAt: now });
      await batch.commit();
      assert.equal((await staff()).xpDelta, -70);
      assert.equal((await staff()).xpDelta, 0);
      assert.equal((await db.doc(base).get()).data().validatedXp, 0);
      assert.equal((await db.collection(`${base}/xpAudit`).get()).size, 2);
      const events = await db.collection(`${base}/xpEvents`).get();
      assert.ok(events.docs.every(d => d.data().status === 'revoked'));
    });
    await t.test('código caducado y visita pendiente no pueden confirmarse', async () => {
      await seed();
      await db.doc('visitCodes/visit-a').update({ expiresAt: Timestamp.fromMillis(Date.now() - 10000) });
      const client = env.authenticatedContext('staff-a').firestore();
      await assertFails(setDoc(doc(client, 'loyaltyVisits/visit-a'), { requestId: 'visit-a', userId: 'user-a', placeId: 'place-a', status: 'confirmed', confirmedBy: 'staff-a', confirmedAt: serverTimestamp() }));
      await seed();
      const batch = writeBatch(client), timestamp = serverTimestamp();
      batch.update(doc(client, 'visitCodes/visit-a'), { status: 'confirmed', confirmedBy: 'staff-a', confirmedAt: timestamp, updatedAt: timestamp });
      batch.set(doc(client, 'loyaltyVisits/visit-a'), { requestId: 'visit-a', userId: 'user-a', placeId: 'place-a', status: 'pending', confirmedBy: 'staff-a', confirmedAt: timestamp });
      await assertFails(batch.commit());
    });
    await t.test('regla reforzada rechaza visita sin confirmar código', async () => {
      await seed();
      const client = env.authenticatedContext('staff-a').firestore();
      await assertFails(setDoc(doc(client, 'loyaltyVisits/visit-a'), { requestId: 'visit-a', userId: 'user-a', placeId: 'place-a', status: 'confirmed', confirmedBy: 'staff-a', confirmedAt: serverTimestamp() }));
      await assert.rejects(staff(), /inexistente/);
      assert.equal((await db.doc(base).get()).exists, false);
    });
  } finally {
    await env.cleanup();
    await deleteApp(app);
  }
});
