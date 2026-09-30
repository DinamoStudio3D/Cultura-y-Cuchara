'use strict';

const core = require('../js/chabaquito-v1-core');
const storage = require('./chabaquito-v1-storage');
const { planDigitalCompletion, digitalEvidence } = require('./chabaquito-v1-digital-persistence');

const { documentId } = storage;
function millis(value) {
  return value && typeof value.toMillis === 'function' ? value.toMillis() : Number(value || 0);
}

async function persistDigitalCompletion({ db, authenticatedUid, objectiveId, now = Date.now() }) {
  if (!db || typeof db.runTransaction !== 'function') throw new Error('Base de datos no disponible.');
  const uid = String(authenticatedUid || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('Usuario no autenticado o no válido.');

  const { profile: profileRef, evidence, events, progress: progressRef } = storage.references(db, uid);
  const key = core.evidenceKey(digitalEvidence(objectiveId, now));
  const evidenceRef = evidence.doc(documentId(key));

  return db.runTransaction(async tx => {
    const [profileSnap, evidenceQuery, eventsQuery] = await Promise.all([
      tx.get(profileRef),
      tx.get(profileRef.collection('evidence')),
      tx.get(profileRef.collection('xpEvents'))
    ]);
    const profile = profileSnap.exists ? profileSnap.data() : null;
    const storedEvidence = evidenceQuery.docs.map(doc => ({ ...doc.data(), verifiedAt: millis(doc.data().verifiedAt) }));
    const storedEvents = storage.readEvents(eventsQuery);
    const plan = planDigitalCompletion({ uid, objectiveId, storedEvidence, storedEvents, profile, now });

    const changed = plan.evidenceChanged || plan.delta.grant.length > 0 || plan.delta.revoke.length > 0;
    if (!changed) return { changed: false, xp: plan.profile.validatedXp, adventureXp: plan.result.xp, completedObjectives: plan.result.completedObjectives };
    if (plan.evidenceChanged) tx.create(evidenceRef, { ...plan.evidence, schemaVersion: storage.VERSION });
    storage.writeEvents(tx, events, eventsQuery, plan.delta, now);
    tx.set(profileRef, { ...plan.profile, schemaVersion: storage.VERSION }, { merge: true });
    tx.set(progressRef, {
      schemaVersion: storage.VERSION,
      userId: uid,
      adventureId: core.PILOT.id,
      completedObjectives: plan.result.completedObjectives,
      availableObjectives: plan.result.availableObjectives,
      completed: plan.result.completed,
      xp: plan.result.xp,
      badgeIds: plan.result.badgeIds,
      updatedAt: now
    }, { merge: true });

    tx.create(profileRef.collection('xpAudit').doc(), {
      schemaVersion: storage.VERSION, evidenceKey: key, grants: plan.delta.grant,
      revocations: plan.delta.revoke, action: 'validated', processedAt: now
    });

    return {
      changed: plan.evidenceChanged || plan.delta.grant.length > 0 || plan.delta.revoke.length > 0,
      xp: plan.profile.validatedXp,
      adventureXp: plan.result.xp,
      completedObjectives: plan.result.completedObjectives
    };
  });
}

module.exports = { documentId, persistDigitalCompletion };
