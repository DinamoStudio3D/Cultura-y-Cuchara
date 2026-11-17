import fs from 'node:fs';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

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
  // Native administrative permissions: use only synthetic accounts in the emulator.
  const accessAdmin = env.authenticatedContext('access-admin', {admin: true, email: 'admin@example.com'}).firestore();
  const accessVisitor = env.authenticatedContext('access-visitor', {email: 'visitor@example.com'}).firestore();
  const accessOwner = env.authenticatedContext('access-owner', {email: 'owner@example.com'}).firestore();
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'adminUsers', 'access-owner'), {role: 'owner', active: true});
    await setDoc(doc(ctx.firestore(), 'userProfiles', 'access-target'), {email: 'target@example.com', fullName: 'Synthetic target'});
  });
  const grantFields = {email: 'target@example.com', displayName: 'Synthetic target', role: 'admin', active: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: 'access-admin'};
  await assertFails(setDoc(doc(accessVisitor, 'adminUsers', 'access-visitor'), {...grantFields, updatedBy: 'access-visitor'}));
  await assertFails(setDoc(doc(accessOwner, 'adminUsers', 'access-target'), {...grantFields, updatedBy: 'access-owner'}));
  await assertFails(getDoc(doc(accessOwner, 'userProfiles', 'access-target')));
  await assertSucceeds(getDoc(doc(accessAdmin, 'userProfiles', 'access-target')));
  const nativeGrant = writeBatch(accessAdmin);
  nativeGrant.set(doc(accessAdmin, 'adminUsers', 'access-target'), grantFields);
  const auditFields = {action: 'admin.access_saved', module: 'access', summary: 'Synthetic Android grant',
    details: {targetUid: 'access-target', role: 'admin', active: true}, actorUid: 'access-admin',
    actorEmail: 'admin@example.com', createdAt: serverTimestamp()};
  nativeGrant.set(doc(accessAdmin, 'adminAudit', 'native-access-audit'), auditFields);
  await assertSucceeds(nativeGrant.commit());
  assert.equal((await getDoc(doc(accessAdmin, 'adminUsers', 'access-target'))).data().role, 'admin');
  await assertFails(updateDoc(doc(accessAdmin, 'adminAudit', 'native-access-audit'), {summary: 'Changed'}));
  // A failed audit must roll back the permission in the same atomic write.
  const rejectedGrant = writeBatch(accessAdmin);
  rejectedGrant.set(doc(accessAdmin, 'adminUsers', 'access-rejected'), grantFields);
  rejectedGrant.set(doc(accessAdmin, 'adminAudit', 'native-access-rejected'), {...auditFields, actorUid: 'other-actor'});
  await assertFails(rejectedGrant.commit());
  assert.equal((await getDoc(doc(accessAdmin, 'adminUsers', 'access-rejected'))).exists(), false);
  const profileAdmin = env.authenticatedContext('access-target', {email: 'target@example.com'}).firestore();
  await assertSucceeds(getDoc(doc(profileAdmin, 'userProfiles', 'access-other')));
  await assertSucceeds(updateDoc(doc(accessAdmin, 'adminUsers', 'access-target'), {active: false,
    updatedAt: serverTimestamp(), updatedBy: 'access-admin'}));
  await assertFails(getDoc(doc(profileAdmin, 'userProfiles', 'access-other')));
  console.log('PASS native administrative grants: self-promotion denied, owner scope, atomic audit and revoked profile');

  // Native place creation keeps the public document, private PIN and audit atomic.
  const placeBatch = writeBatch(accessAdmin);
  placeBatch.set(doc(accessAdmin, 'locales', 'native-admin-created'), {title: 'Synthetic place', category: 'cafe', publicationStatus: 'draft', lat: -3.99, lng: -79.2});
  placeBatch.set(doc(accessAdmin, 'passportPins', 'native-admin-created'), {pin: '6789', updatedAt: serverTimestamp()});
  placeBatch.set(doc(accessAdmin, 'adminAudit', 'native-place-audit'), {...auditFields, action: 'place.created', module: 'places', details: {placeId: 'native-admin-created'}});
  await assertSucceeds(placeBatch.commit());
  const publicPlace = await assertSucceeds(getDoc(doc(accessVisitor, 'locales', 'native-admin-created')));
  assert.equal(Object.hasOwn(publicPlace.data(), 'pin'), false);
  await assertFails(getDoc(doc(accessVisitor, 'passportPins', 'native-admin-created')));
  await assertFails(setDoc(doc(accessOwner, 'locales', 'native-owner-created'), {title: 'Unauthorized'}));
  const rejectedPlace = writeBatch(accessAdmin);
  rejectedPlace.set(doc(accessAdmin, 'locales', 'native-admin-rollback'), {title: 'Rollback'});
  rejectedPlace.set(doc(accessAdmin, 'passportPins', 'native-admin-rollback'), {pin: '9876'});
  rejectedPlace.set(doc(accessAdmin, 'adminAudit', 'native-place-rollback'), {...auditFields, actorUid: 'wrong-actor'});
  await assertFails(rejectedPlace.commit());
  assert.equal((await getDoc(doc(accessAdmin, 'locales', 'native-admin-rollback'))).exists(), false);
  assert.equal((await getDoc(doc(accessAdmin, 'passportPins', 'native-admin-rollback'))).exists(), false);
  console.log('PASS native place creation: private PIN, admin scope and atomic rollback');

  // Owner and staff assignments use both permission stores without giving staff legacy owner fallback.
  const assignedOwner = env.authenticatedContext('assigned-owner', {email: 'owner-business@example.com'}).firestore();
  const assignedStaff = env.authenticatedContext('assigned-staff', {email: 'staff-business@example.com'}).firestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'locales', 'assigned-place'), {title: 'Assigned synthetic place', category: 'cafe'});
    await setDoc(doc(db, 'loyaltyCounters', 'assigned-counter'), {userId: 'synthetic-client', placeId: 'assigned-place', visitCount: 1});
    await setDoc(doc(db, 'loyaltyCounters', 'other-counter'), {userId: 'synthetic-other', placeId: 'unrelated-place', visitCount: 1});
  });
  const assignment = writeBatch(accessAdmin);
  for (const [target, email, role] of [['assigned-owner','owner-business@example.com','owner'], ['assigned-staff','staff-business@example.com','staff']]) {
    assignment.set(doc(accessAdmin, 'missionRewardMerchants', target), {email, active: true, placeIds: ['assigned-place'], campaignIds: ['existing-campaign']});
    assignment.set(doc(accessAdmin, 'businessAccess', target + '_assigned-place'), {uid: target, email, placeId: 'assigned-place', role, active: true, assignmentScope: role});
  }
  assignment.set(doc(accessAdmin, 'adminAudit', 'native-assignment-audit'), {...auditFields, action: 'business.assignments_saved', module: 'business'});
  await assertSucceeds(assignment.commit());
  await assertSucceeds(getDoc(doc(assignedOwner, 'loyaltyCounters', 'assigned-counter')));
  await assertSucceeds(getDoc(doc(assignedStaff, 'loyaltyCounters', 'assigned-counter')));
  await assertFails(getDoc(doc(assignedStaff, 'loyaltyCounters', 'other-counter')));
  await assertSucceeds(updateDoc(doc(assignedOwner, 'locales', 'assigned-place'), {desc: 'Owner update', merchantUpdatedBy: 'assigned-owner', merchantUpdatedAt: serverTimestamp()}));
  await assertFails(updateDoc(doc(assignedStaff, 'locales', 'assigned-place'), {desc: 'Staff cannot edit', merchantUpdatedBy: 'assigned-staff', merchantUpdatedAt: serverTimestamp()}));
  await assertFails(updateDoc(doc(assignedStaff, 'businessAccess', 'assigned-staff_assigned-place'), {role: 'owner'}));
  await assertFails(updateDoc(doc(assignedStaff, 'missionRewardMerchants', 'assigned-staff'), {placeIds: ['unrelated-place']}));
  const revoke = writeBatch(accessAdmin);
  revoke.update(doc(accessAdmin, 'missionRewardMerchants', 'assigned-owner'), {active: false, placeIds: []});
  revoke.update(doc(accessAdmin, 'businessAccess', 'assigned-owner_assigned-place'), {active: false, assignmentScope: 'none'});
  revoke.set(doc(accessAdmin, 'adminAudit', 'native-assignment-revoke'), {...auditFields, action: 'business.assignments_saved', module: 'business'});
  await assertSucceeds(revoke.commit());
  await assertFails(getDoc(doc(assignedOwner, 'loyaltyCounters', 'assigned-counter')));
  await assertFails(updateDoc(doc(assignedOwner, 'locales', 'assigned-place'), {desc: 'Revoked owner', merchantUpdatedBy: 'assigned-owner', merchantUpdatedAt: serverTimestamp()}));
  assert.deepEqual((await getDoc(doc(accessAdmin, 'missionRewardMerchants', 'assigned-owner'))).data().campaignIds, ['existing-campaign']);
  const badAssignment = writeBatch(accessAdmin);
  badAssignment.set(doc(accessAdmin, 'missionRewardMerchants', 'rollback-owner'), {active: true, placeIds: ['assigned-place']});
  badAssignment.set(doc(accessAdmin, 'businessAccess', 'rollback-owner_assigned-place'), {uid: 'rollback-owner', placeId: 'assigned-place', active: true, role: 'owner'});
  badAssignment.set(doc(accessAdmin, 'adminAudit', 'native-assignment-rollback'), {...auditFields, actorUid: 'wrong-actor'});
  await assertFails(badAssignment.commit());
  assert.equal((await getDoc(doc(accessAdmin, 'missionRewardMerchants', 'rollback-owner'))).exists(), false);
  assert.equal((await getDoc(doc(accessAdmin, 'businessAccess', 'rollback-owner_assigned-place'))).exists(), false);
  console.log('PASS native business assignments: scoped reads, staff editing denied, atomic revocation and rollback');

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
