'use strict';
const assert = require('node:assert/strict');
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, Timestamp} = require('firebase-admin/firestore');
const {execute} = require('../../functions/rewards-draft-store');
const {PRIZES, CLAIMS} = require('../../functions/rewards-preview-redemption');

async function main() {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8089');
  const app = initializeApp({projectId: 'demo-visitaloja-rules'});
  try {
    const db = getFirestore(app);
    const placeId = 'test-cafe';
    const env = {VERCEL_ENV: 'preview', REWARDS_DRAFT_WRITES: 'approved-preview-v1'};
    const run = (uid, action, data = {}, now = Timestamp.now()) =>
      execute({db, user: {uid}, input: {placeId, action, ...data}, now, env});
    await db.doc('businessAccess/owner_test-cafe').set({uid: 'owner', placeId, role: 'owner', active: true});
    await db.doc('adminUsers/admin').set({active: true, role: 'admin'});
    const draft = {title: 'Café gratis', description: 'Una bebida', targetVisits: 10, validityDays: 30, stock: 1, rewardType: 'product'};
    await run('owner', 'save', {revision: 0, draft});
    await run('owner', 'submit', {revision: 1});
    await assert.rejects(run('admin', 'publish', {authorUid: 'owner', revision: 2}), {status: 409});
    await run('admin', 'approve', {authorUid: 'owner', revision: 2});
    await assert.rejects(run('owner', 'publish', {revision: 3}), {status: 403});
    const published = await run('admin', 'publish', {authorUid: 'owner', revision: 3});
    const {prizeId} = published.draft;
    await assert.rejects(run('admin', 'publish', {authorUid: 'owner', revision: 3}), {status: 409});
    await assert.rejects(run('customer', 'claim', {prizeId}), /sellos requeridos/);
    for (const uid of ['customer', 'second']) {
      await db.doc('loyaltyCounters/' + uid).set({userId: uid, placeId, visitCount: 10});
    }
    await assert.rejects(run('customer', 'claim', {prizeId}, Timestamp.fromMillis(Date.now() + 31 * 86400000)), /venció/);
    const attempts = await Promise.allSettled(['customer', 'second'].map(uid => run(uid, 'claim', {prizeId})));
    const winner = attempts.find(attempt => attempt.status === 'fulfilled').value.claim;
    assert.equal(attempts.filter(attempt => attempt.status === 'fulfilled').length, 1);
    assert.match(attempts.find(attempt => attempt.status === 'rejected').reason.message, /cupos/);
    const repeated = await run(winner.userId, 'claim', {prizeId});
    assert.equal(repeated.claim.claimId, winner.claimId);
    await assert.rejects(run(winner.userId, 'deliver', {claimId: winner.claimId}), {status: 403});
    const deliveries = await Promise.all([run('admin', 'deliver', {claimId: winner.claimId}), run('admin', 'deliver', {claimId: winner.claimId})]);
    assert.equal(deliveries[0].claim.status, 'delivered');
    assert.ok(deliveries[0].claim.deliveredAt.isEqual(deliveries[1].claim.deliveredAt));
    assert.equal((await db.collection(CLAIMS).get()).size, 1);
    assert.equal((await db.collection(PRIZES).doc(prizeId).get()).data().remaining, 0);
    assert.equal((await db.doc('loyaltyCounters/' + winner.userId).get()).data().visitCount, 10);
    console.log('Flujo verificado: publicación autorizada, vigencia, sellos, último cupo y reintento sin duplicado.');
  } finally {
    await deleteApp(app);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
