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
    const claimInput = {claimId: winner.claimId};
    await db.doc('missionRewardMerchants/staff').set({active: true, placeIds: [placeId]});
    await db.doc('missionRewardMerchants/other').set({active: true, placeIds: ['otra-parada']});
    await db.doc('missionRewardMerchants/inactive').set({active: false, placeIds: [placeId]});
    await assert.rejects(run('other', 'deliver', claimInput), {status: 403});
    await assert.rejects(run('other', 'deliver', {...claimInput, placeId: 'otra-parada'}), {status: 404});
    await assert.rejects(run('inactive', 'deliver', claimInput), {status: 403});
    const deliveries = await Promise.all([run('staff', 'deliver', claimInput), run('admin', 'deliver', claimInput)]);
    assert.equal(deliveries.filter(item => !item.alreadyDelivered).length, 1);
    assert.equal(deliveries[0].claim.userId, undefined);
    assert.equal(deliveries[0].claim.status, 'delivered');
    assert.ok(deliveries[0].claim.deliveredAt.isEqual(deliveries[1].claim.deliveredAt));
    assert.equal((await db.collection(CLAIMS).get()).size, 1);
    assert.equal((await db.collection(PRIZES).doc(prizeId).get()).data().remaining, 0);
    assert.equal((await db.doc('loyaltyCounters/' + winner.userId).get()).data().visitCount, 10);
    const seasonal = {...draft, seasonStart: '2030-06-10', seasonEnd: '2030-06-10',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/reward.jpg'};
    const before = Timestamp.fromDate(new Date('2030-06-10T04:59:59.999Z'));
    const start = Timestamp.fromDate(new Date('2030-06-10T05:00:00Z'));
    const end = Timestamp.fromDate(new Date('2030-06-11T05:00:00Z'));
    await run('owner', 'save', {revision: 4, draft}, before);
    await run('owner', 'submit', {revision: 5}, before);
    await run('admin', 'approve', {authorUid: 'owner', revision: 6}, before);
    const normal = await run('admin', 'publish', {authorUid: 'owner', revision: 7}, before);
    const normalId = normal.draft.prizeId;
    await assert.rejects(run('owner', 'save', {revision: 8, draft: {...seasonal, seasonEnd: '2030-06-09'}}), {status: 400});
    await assert.rejects(run('owner', 'save', {revision: 8, draft: {...seasonal, imageUrl: 'https://example.com/image.jpg'}}), {status: 400});
    await run('owner', 'save', {revision: 8, draft: seasonal}, before);
    await run('owner', 'submit', {revision: 9}, before);
    await run('admin', 'approve', {authorUid: 'owner', revision: 10}, before);
    await assert.rejects(run('admin', 'publish', {authorUid: 'owner', revision: 11}, end), /ya terminó/);
    const seasonPrize = await run('admin', 'publish', {authorUid: 'owner', revision: 11}, before);
    const seasonInput = {prizeId: seasonPrize.draft.prizeId};
    assert.equal((await run('customer', 'prize', {}, before)).prize.prizeId, normalId);
    assert.equal((await run('customer', 'prize', {}, start)).prize.prizeId, seasonInput.prizeId);
    assert.equal((await run('customer', 'prize', {}, end)).prize.prizeId, normalId);
    await assert.rejects(run('customer', 'claim', {prizeId: normalId}, start), /no es el vigente/);
    const details = await run('customer', 'prize', seasonInput);
    assert.equal(details.prize.imageUrl, seasonal.imageUrl);
    assert.equal(details.prize.startsAtMs, start.toMillis());
    assert.equal(details.prize.expiresAtMs, end.toMillis());
    await assert.rejects(run('customer', 'claim', seasonInput, before), /todavía no empieza/);
    await assert.rejects(run('customer', 'claim', seasonInput, end), /venció/);
    assert.equal((await run('customer', 'claim', seasonInput, start)).claim.status, 'claimed');
    assert.equal((await run('customer', 'claim', {prizeId: normalId}, end)).claim.status, 'claimed');
    const stampTime = Timestamp.now();
    await db.doc('siteContent/passport').set({active: true, campaignId: 'test-campaign'});
    await db.doc('locales/test-cafe').set({title: 'Café de prueba'});
    const passport = {kind: 'sponsored', sponsor: placeId, title: 'Beneficio del pasaporte', terms: '', milestone: 2, stock: 1, expiry: ''};
    await assert.rejects(run('owner', 'passportPublish', passport), {status: 403});
    const publishedPassport = await run('admin', 'passportPublish', passport);
    await assert.rejects(run('admin', 'passportPublish', passport), {status: 409});
    assert.equal((await run('admin', 'passportList')).prizes[0].prizeId, publishedPassport.prizeId);
    async function stamp(requestId, stop, status = 'confirmed') {
      await db.doc('loyaltyVisits/' + requestId).set({userId: 'customer', placeId: stop, status, confirmedAt: stampTime});
      await db.doc('securePassportStamps/' + requestId).set({userId: 'customer', placeId: stop, requestId, campaignId: 'test-campaign', confirmedAt: stampTime});
    }
    await stamp('visit1', placeId);
    await stamp('visit2', placeId);
    await stamp('reversed', 'otra-parada', 'reversed');
    await assert.rejects(run('customer', 'passportClaim', publishedPassport), /meta de sellos/);
    await stamp('visit3', 'otra-parada');
    const [firstPassport, retryPassport] = await Promise.all([
      run('customer', 'passportClaim', publishedPassport), run('customer', 'passportClaim', publishedPassport)
    ]);
    assert.equal(firstPassport.claim.claimId, retryPassport.claim.claimId);
    assert.equal((await db.collection('securePassportStamps').get()).size, 4);
    assert.deepEqual((await db.doc('loyaltyVisits/visit3').get()).data(),
      {userId: 'customer', placeId: 'otra-parada', status: 'confirmed', confirmedAt: stampTime});
    await assert.rejects(run('second', 'passportClaim', publishedPassport), /cupos/);
    assert.equal((await run('staff', 'deliver', {claimId: firstPassport.claim.claimId})).claim.status, 'delivered');
    const general = await run('admin', 'passportPublish', {...passport, kind: 'general', title: 'Premio general', stock: null});
    const generalClaim = (await run('customer', 'passportClaim', general)).claim;
    await assert.rejects(run('staff', 'deliver', {claimId: generalClaim.claimId}), {status: 404});
    assert.equal((await run('admin', 'deliver', {claimId: generalClaim.claimId})).claim.status, 'delivered');
    console.log('Flujo verificado: publicación autorizada, vigencia, sellos, último cupo y reintento sin duplicado.');
  } finally {
    await deleteApp(app);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
