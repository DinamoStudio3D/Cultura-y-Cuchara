/* Android visit/reward contract against the local emulator and actual Worker logic.
 * No production credentials, cloud accounts, remote requests or real customer data.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, setDoc, getDocFromServer, updateDoc, runTransaction, serverTimestamp} from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host || '', /^(127\.0\.0\.1|localhost):[0-9]+$/, 'A local Firestore emulator is required');
const project = 'demo-visitaloja';
const origin = 'http://' + host;
const documents = `/v1/projects/${project}/databases/(default)/documents`;
const env = await initializeTestEnvironment({projectId: project, firestore: {host: host.split(':')[0], port: Number(host.split(':')[1]), rules: fs.readFileSync('firestore.rules', 'utf8')}});
const place = 'journey-place', owner = 'journey-owner', customer = 'journey-customer', second = 'journey-reversal-client';
const actor = uid => env.authenticatedContext(uid, {email: uid + '@example.test'}).firestore();
const client = actor(customer), merchant = actor(owner), outsider = actor('journey-other-owner');
const workerSource = fs.readFileSync('workers/chabaquito/worker-preview.js', 'utf8');
assert.equal(workerSource.split('const PROJECT_ID = "cultura-y-cuchara";').length, 2);
let commits = 0;
const context = {crypto: webcrypto, console, TextEncoder, TextDecoder, URL, Intl, Date, Uint8Array, Map, Set, atob, btoa,
    fetch: async (url, options = {}) => {
        const parsed = new URL(url);
        assert.equal(parsed.origin, 'https://firestore.googleapis.com', 'Unexpected Worker network destination');
        assert(parsed.pathname.startsWith(documents), 'Unexpected project/path');
        if (parsed.pathname.endsWith(':commit')) commits++;
        return fetch(origin + parsed.pathname + parsed.search, {...options, headers: {...options.headers, Authorization: 'Bearer owner'}});
    }};
vm.createContext(context);
vm.runInContext(workerSource.replace('const PROJECT_ID = "cultura-y-cuchara";', `const PROJECT_ID = "${project}";`).replace('export default {', 'const workerHandler = {'), context);
// Retain real transaction/read/commit/consumption/reward logic. Only OAuth and
// the unrelated Missions refresh are replaced in this local contract test.
vm.runInContext("getGoogleAccessToken=async()=> 'owner';syncUserMissionProgress=async()=>({});", context);
const stampDay = context.ecuadorDay();
const id = code => `${stampDay}_${place}_${code}`;
const claimId = uid => `${uid}_${place}_1`;
const counterId = uid => `${uid}_${place}`;
const seconds = Math.floor(Date.now() / 1000);
function token(uid) {
    return [Buffer.from(JSON.stringify({alg: 'none', typ: 'JWT'})).toString('base64url'), Buffer.from(JSON.stringify({iss: `https://securetoken.google.com/${project}`, aud: project, auth_time: seconds, email: uid + '@example.test', user_id: uid, sub: uid, iat: seconds, exp: seconds + 3600, firebase: {sign_in_provider: 'custom', identities: {}}})).toString('base64url'), ''].join('.');
}
async function createCode(uid, code) {
    const values = {userId: uid, userName: 'Cliente ficticio', userEmail: uid + '@example.test', placeId: place, placeName: 'Parada ficticia', code, status: 'pending'};
    const fields = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, {stringValue: value}]));
    fields.expiresAt = {timestampValue: new Date(Date.now() + 9 * 60000).toISOString()};
    const response = await fetch(origin + documents + ':commit', {method: 'POST', headers: {Authorization: 'Bearer ' + token(uid), 'Content-Type': 'application/json'}, body: JSON.stringify({writes: [{update: {name: `projects/${project}/databases/(default)/documents/visitCodes/${id(code)}`, fields}, currentDocument: {exists: false}, updateTransforms: [{fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME'}]}]})});
    assert.equal(response.status, 200, await response.text());
}
const confirmation = code => ({requestId: id(code), recordKind: 'courtesy', purchaseAmount: 0, consumptionReason: 'Ensayo aislado del recorrido'});
async function read(db, collection, key) {return getDocFromServer(doc(db, collection, key));}

try {
    await env.withSecurityRulesDisabled(async c => {
        const db = c.firestore();
        await setDoc(doc(db, 'locales', place), {title: 'Parada ficticia', category: 'cafe', active: true, publicationStatus: 'published'});
        await setDoc(doc(db, 'missionRewardMerchants', owner), {active: true, placeIds: [place], businessName: 'Encargado ficticio'});
        await setDoc(doc(db, 'missionRewardMerchants', 'journey-other-owner'), {active: true, placeIds: ['journey-other-place']});
        await setDoc(doc(db, 'loyaltyPrograms', place), {active: true, targetVisits: 10, maxVisitsPerDay: 1, rewardTitle: 'Café ficticio', rewardValidityDays: 30, claimedCount: 0, stock: 2});
        for (const uid of [customer, second]) await setDoc(doc(db, 'loyaltyCounters', counterId(uid)), {userId: uid, placeId: place, visitCount: 9, rewardCycles: 0, lastVisitDay: '2000-01-01', dailyVisitCount: 0, totalSpend: 0});
        await setDoc(doc(db, 'siteContent', 'passport'), {campaignId: 'journey-passport'});
    });
    await createCode(customer, '123456');
    assert.equal((await assertSucceeds(read(client, 'visitCodes', id('123456')))).data().status, 'pending');
    await assertSucceeds(read(merchant, 'visitCodes', id('123456')));
    await assertFails(read(outsider, 'visitCodes', id('123456')));
    const result = await context.confirmMerchantVisit({}, {uid: owner}, confirmation('123456'));
    assert.equal(result.visitCount, 10); assert.equal(result.rewardCreated, true);
    assert.equal((await read(client, 'visitCodes', id('123456'))).data().status, 'confirmed');
    assert.equal((await read(client, 'loyaltyCounters', counterId(customer))).data().visitCount, 10);
    const reward = doc(client, 'loyaltyRewardClaims', claimId(customer));
    const saved = await assertSucceeds(getDocFromServer(reward));
    assert.equal(saved.data().status, 'pending'); assert.match(saved.data().claimCode, /^FID-/);
    await assertFails(updateDoc(reward, {status: 'delivered', deliveredBy: customer, deliveredAt: serverTimestamp(), updatedAt: serverTimestamp()}));
    await assertFails(read(outsider, 'loyaltyRewardClaims', claimId(customer)));
    console.log('PASS native pending-code creation → Worker confirmation → customer counter/reward → role boundaries');

    // A second synthetic customer exercises the real reversal before delivery.
    await createCode(second, '345678');
    await context.confirmMerchantVisit({}, {uid: owner}, confirmation('345678'));
    await context.reverseMerchantVisit({}, {uid: owner}, {requestId: id('345678'), reversalReason: 'Anulación dentro del ensayo aislado'});
    assert.equal((await read(actor(second), 'loyaltyCounters', counterId(second))).data().visitCount, 9);
    assert.equal((await read(actor(second), 'visitCodes', id('345678'))).data().status, 'reversed');
    await env.withSecurityRulesDisabled(async c => assert.equal((await read(c.firestore(), 'loyaltyRewardClaims', claimId(second))).exists(), false));
    console.log('PASS reversal restores counter and removes the pending reward');

    // Same read/validate/update shape and fields as MerchantRewardViewModel.
    const claim = doc(merchant, 'loyaltyRewardClaims', claimId(customer));
    await assertSucceeds(runTransaction(merchant, async tx => {
        const access = (await tx.get(doc(merchant, 'missionRewardMerchants', owner))).data();
        const live = (await tx.get(claim)).data();
        assert.equal(access.active, true); assert(access.placeIds.includes(live.placeId));
        assert.equal(live.status, 'pending'); assert(live.expiresAt.toMillis() > Date.now());
        tx.update(claim, {status: 'delivered', deliveredBy: owner, deliveredAt: serverTimestamp(), updatedAt: serverTimestamp()});
    }));
    assert.equal((await read(client, 'loyaltyRewardClaims', claimId(customer))).data().status, 'delivered');
    await assertFails(updateDoc(claim, {status: 'delivered', deliveredBy: owner, deliveredAt: serverTimestamp(), updatedAt: serverTimestamp()}));
    console.log('PASS native delivery transaction → customer sees delivered → duplicate delivery denied');

    // Failure cases run last so an intentionally rejected backend transaction
    // cannot hold a read lock needed by another successful scenario.
    await createCode(customer, '234567');
    for (const [run, pattern] of [
        [() => context.confirmMerchantVisit({}, {uid: 'journey-other-owner'}, confirmation('234567')), /cannot confirm/],
        [() => context.confirmMerchantVisit({}, {uid: owner}, confirmation('123456')), /not pending/],
        [() => context.confirmMerchantVisit({}, {uid: owner}, confirmation('234567')), /Daily visit limit/],
        [() => context.reverseMerchantVisit({}, {uid: owner}, {requestId: id('123456'), reversalReason: 'No debe anular un premio entregado'}), /entreg|deliver|reward/i]
    ]) {
        const before = commits;
        await assert.rejects(run(), pattern);
        assert.equal(commits, before, 'A rejected operation must not commit');
    }
    assert.equal((await read(client, 'loyaltyCounters', counterId(customer))).data().visitCount, 10);
    console.log('PASS wrong business, repeated confirmation, daily limit and delivered-reward reversal rejected without writes');
} finally {
    await env.cleanup();
}
