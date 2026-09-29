'use strict';

const core = require('../js/chabaquito-v1-core');
const { planDigitalCompletion } = require('./chabaquito-v1-digital-persistence');

function documentId(value) {
  return Buffer.from(String(value), 'utf8').toString('base64url');
}
function millis(value) {
  return value && typeof value.toMillis === 'function' ? value.toMillis() : Number(value || 0);
}

async function persistDigitalCompletion({ db, authenticatedUid, objectiveId, now = Date.now() }) {
  if (!db || typeof db.runTransaction !== 'function') throw new Error('Base de datos no disponible.');
  const uid = String(authenticatedUid || '').trim();
  if (!uid) throw new Error('Usuario no autenticado.');

  const profileRef = db.collection(core.COLLECTIONS.profiles).doc(uid);
  const evidenceRef = profileRef.collection('evidence').doc(documentId(`digital_objective:${objectiveId}`));
  const progressRef = profileRef.collection('adventures').doc(core.PILOT.id);

  return db.runTransaction(async tx => {
    const [profileSnap, evidenceSnap, evidenceQuery, eventsQuery] = await Promise.all([
      tx.get(profileRef),
      tx.get(evidenceRef),
      tx.get(profileRef.collection('evidence')),
      tx.get(profileRef.collection('xpEvents'))
    ]);
    const profile = profileSnap.exists ? profileSnap.data() : null;
    const storedEvidence = evidenceQuery.docs.map(doc => ({ ...doc.data(), verifiedAt: millis(doc.data().verifiedAt) }));
    const storedEvents = eventsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const plan = planDigitalCompletion({ uid, objectiveId, storedEvidence, storedEvents, profile, now });

    if (!evidenceSnap.exists) tx.create(evidenceRef, plan.evidence);
    for (const event of plan.delta.grant) {
      tx.set(profileRef.collection('xpEvents').doc(event.id), { ...event, status: 'granted', updatedAt: now }, { merge: true });
    }
    for (const event of plan.delta.revoke) {
      tx.set(profileRef.collection('xpEvents').doc(event.id), { ...event, status: 'revoked', updatedAt: now }, { merge: true });
    }
    tx.set(profileRef, plan.profile, { merge: true });
    tx.set(progressRef, {
      adventureId: core.PILOT.id,
      completedObjectives: plan.result.completedObjectives,
      availableObjectives: plan.result.availableObjectives,
      completed: plan.result.completed,
      xp: plan.result.xp,
      badgeIds: plan.result.badgeIds,
      updatedAt: now
    }, { merge: true });

    return {
      changed: plan.evidenceChanged || plan.delta.grant.length > 0 || plan.delta.revoke.length > 0,
      xp: plan.profile.validatedXp,
      adventureXp: plan.result.xp,
      completedObjectives: plan.result.completedObjectives
    };
  });
}

module.exports = { documentId, persistDigitalCompletion };
