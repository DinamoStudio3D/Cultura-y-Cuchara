import fs from 'node:fs';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-visitaloja',
  firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }
});
try {
  const visitor = env.unauthenticatedContext().firestore();
  const admin = env.authenticatedContext('test-admin', { admin: true }).firestore();
  const qr = doc(visitor, 'qrCodes', 'sample-menu');
  const view = doc(visitor, 'qrMenuViews', 'sample-view');
  const plan = doc(visitor, 'qrSubscriptionPlans', 'sample-plan');

  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'qrCodes', 'sample-menu'), { active: true, title: 'Demo' });
  });

  await assertSucceeds(getDoc(qr));
  await assertFails(setDoc(qr, { active: false }));
  await assertFails(updateDoc(qr, { active: false }));
  await assertFails(deleteDoc(qr));

  await assertSucceeds(setDoc(view, {
    menuId: 'sample-menu', day: '2026-10-14', createdAt: serverTimestamp()
  }));
  await assertFails(getDoc(view));
  await assertFails(updateDoc(view, { menuId: 'other' }));
  await assertFails(deleteDoc(view));
  await assertFails(setDoc(doc(visitor, 'qrMenuViews', 'invalid'), {
    menuId: 'bad/menu', day: 'not-a-day', createdAt: serverTimestamp()
  }));

  await assertFails(getDoc(plan));
  await assertFails(setDoc(plan, { title: 'Hacked' }));
  await assertSucceeds(setDoc(doc(admin, 'qrSubscriptionPlans', 'sample-plan'), { title: 'Demo' }));
  await assertSucceeds(getDoc(doc(admin, 'qrSubscriptionPlans', 'sample-plan')));
  await assertSucceeds(setDoc(doc(admin, 'qrCodes', 'sample-menu'), { active: true }));
  // Exercise the same atomic REST create used by Android, only against the local emulator.
  const emulator = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8089';
  assert.match(emulator, /^(127\.0\.0\.1|localhost):[0-9]+$/);
  const uid = 'native-customer';
  const customer = env.authenticatedContext(uid, {email: 'native@example.com'}).firestore();
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'locales', 'native-place'), {title: 'Native contract test', active: true, publicationStatus: 'published', category: 'cafe'}); });
  const seconds = Math.floor(Date.now()/1000);
  const jwt = user => [Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({iss:'https://securetoken.google.com/demo-visitaloja',aud:'demo-visitaloja',auth_time:seconds,user_id:user,sub:user,iat:seconds,exp:seconds+3600,email:'native@example.com',firebase:{sign_in_provider:'custom',identities:{}}})).toString('base64url'),''].join('.');
  function nativeWrite(user, id, status='pending') {
    const fields=Object.fromEntries(Object.entries({userId:user,userName:'Native test',userEmail:'native@example.com',placeId:'native-place',placeName:'Native contract test',code:'123456',status}).map(([key,value])=>[key,{stringValue:value}]));
    fields.expiresAt={timestampValue:new Date(Date.now()+9*60000).toISOString()};
    return {writes:[{update:{name:'projects/demo-visitaloja/databases/(default)/documents/visitCodes/'+id,fields},currentDocument:{exists:false},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]}]};
  }
  const commit = async (user, body) => fetch('http://'+emulator+'/v1/projects/demo-visitaloja/databases/(default)/documents:commit',{method:'POST',headers:{Authorization:'Bearer '+jwt(user),'Content-Type':'application/json'},body:JSON.stringify(body)});
  const created=await commit(uid,nativeWrite(uid,'native-contract-code'));
  assert.equal(created.status,200, 'Native atomic REST create must pass current rules: '+await created.text());
  const codeSnap=await assertSucceeds(getDoc(doc(customer,'visitCodes','native-contract-code')));
  assert.equal(codeSnap.data().status,'pending');assert.ok(codeSnap.data().createdAt);
  const duplicate=await commit(uid,nativeWrite(uid,'native-contract-code'));assert.ok(!duplicate.ok,'Create-only precondition must prevent overwrite');
  const forged=await commit(uid,nativeWrite(uid,'native-forged-confirmed','confirmed'));assert.equal(forged.status,403);
  const other=await commit(uid,nativeWrite('native-other','native-other-user'));assert.equal(other.status,403);
  await assertFails(getDoc(doc(env.authenticatedContext('native-other').firestore(),'visitCodes','native-contract-code')));
  await assertFails(updateDoc(doc(customer,'visitCodes','native-contract-code'),{status:'confirmed',confirmedAt:serverTimestamp(),updatedAt:serverTimestamp(),confirmedBy:uid}));
  await assertFails(setDoc(doc(customer,'loyaltyCounters','native-counter'),{userId:uid,placeId:'native-place',visitCount:10}));
  await assertFails(setDoc(doc(customer,'securePassportStamps','native-stamp'),{userId:uid,placeId:'native-place',confirmedBy:uid,confirmedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(customer,'passportCompletions','native-reward'),{userId:uid,status:'pending',claimCode:'PAS-FAKE'}));
  await assertFails(setDoc(doc(customer,'loyaltyRewardClaims','native-reward'),{userId:uid,placeId:'native-place',status:'pending',claimCode:'FID-ABC123',createdAt:serverTimestamp()}));
  console.log('Firestore permissions: native REST visit create, duplicate protection and privilege boundaries passed');

} finally {
  await env.cleanup();
}
