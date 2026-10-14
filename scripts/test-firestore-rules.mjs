import fs from 'node:fs';
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
  console.log('Firestore permissions: visitor and admin scenarios passed');
} finally {
  await env.cleanup();
}
