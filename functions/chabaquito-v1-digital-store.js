'use strict';

const core = require('../js/chabaquito-v1-core');
const { digitalEvidence } = require('./chabaquito-v1-digital');
const ADVENTURE = core.PILOT.id;
const OBJECTIVES = ['descubre', 'cultura'];

async function recordDigitalObjective({ db, uid, objectiveId, answers, now = Date.now() }) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid || '') || !OBJECTIVES.includes(objectiveId) ||
      !Number.isSafeInteger(now) || now <= 0) throw new Error('Solicitud no válida.');
  const profile = db.collection(core.COLLECTIONS.profiles).doc(uid);
  const evidenceRefs = OBJECTIVES.map(id => profile.collection('evidence').doc(`digital_${id}`));
  const eventRefs = OBJECTIVES.map(id => profile.collection('xpEvents').doc(`${ADVENTURE}_${id}`));
  const attemptsRef = profile.collection('attempts').doc(`digital_${new Date(now).toISOString().slice(0, 10)}`);
  const progressRef = db.collection(core.COLLECTIONS.adventures).doc(`${uid}_${ADVENTURE}`);
  return db.runTransaction(async tx => {
    const [profileSnap, attemptsSnap, ...snaps] = await Promise.all([
      tx.get(profile), tx.get(attemptsRef), ...evidenceRefs.map(ref => tx.get(ref)), ...eventRefs.map(ref => tx.get(ref))
    ]);
    const evidence = snaps.slice(0, 2).filter(s => s.exists).map(s => s.data());
    const events = snaps.slice(2).filter(s => s.exists).map(s => s.data());
    const result = digitalEvidence({ uid, objectiveId, answers, existingEvidence: evidence, verifiedAt: now });
    const priorXp = events.filter(e => e.status === 'granted').reduce((sum, e) => sum + e.xp, 0);
    if (profileSnap.exists && profileSnap.data().validatedXp !== priorXp) throw new Error('Saldo XP inconsistente.');
    const index = OBJECTIVES.indexOf(objectiveId);
    if (result.alreadyCompleted) {
      if (!snaps[index + 2].exists) throw new Error('Evidencia inconsistente.');
      return { alreadyCompleted: true, xp: priorXp };
    }
    const attempts = Number(attemptsSnap.exists ? attemptsSnap.data().count : 0);
    if (attempts >= 8) throw new Error('Límite de intentos alcanzado por hoy.');
    tx.set(attemptsRef, { count: attempts + 1, updatedAt: now });
    if (!result.passed) return { passed: false, xp: priorXp };
    const eventId = `${ADVENTURE}:${objectiveId}`;
    if (snaps[index].exists || snaps[index + 2].exists) throw new Error('Evidencia inconsistente.');
    tx.create(evidenceRefs[index], result.evidence);
    const awardedXp = core.PILOT.objectives.find(objective => objective.id === objectiveId).xp;
    tx.create(eventRefs[index], { eventId, evidenceKey: core.evidenceKey(result.evidence), xp: awardedXp, status: 'granted', updatedAt: now });
    const nextEvidence = [...evidence, result.evidence];
    const progress = core.evaluateAdventure(core.PILOT, nextEvidence);
    const xp = priorXp + awardedXp;
    tx.set(profile, { validatedXp: xp, level: core.levelForXp(xp), updatedAt: now,
      ...(profileSnap.exists ? {} : { createdAt: now, publicAlias: '', participateInRanking: false, publicBadgeIds: [] }) }, { merge: true });
    tx.set(progressRef, { userId: uid, adventureId: ADVENTURE, completedObjectives: progress.completedObjectives,
      completed: false, xp, badgeIds: [], updatedAt: now }, { merge: true });
    tx.create(profile.collection('xpAudit').doc(eventRefs[index].id), {
      eventId, action: 'granted', xp: awardedXp, evidenceKey: core.evidenceKey(result.evidence), processedAt: now
    });
    return { passed: true, xp };
  });
}

module.exports = { recordDigitalObjective };
