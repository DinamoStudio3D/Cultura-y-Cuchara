'use strict';

// Servicio para invocación futura desde backend autenticado. No es endpoint ni Function.
const core = require('../js/chabaquito-v1-core');

const storage = require('./chabaquito-v1-storage');
const { documentId } = storage;
function millis(timestamp) {
  const value = timestamp?.toMillis?.() ?? (timestamp instanceof Date ? timestamp.getTime() : NaN);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Fecha de visita no válida.');
  return value;
}

function verifiedVisitEvidence(visitId, visit, code, uid, point = core.POINTS.ESTABLISHMENT_B) {
  if (point?.active !== true || typeof point.placeId !== 'string' || !point.placeId) {
    throw new Error('Establecimiento piloto pendiente de configurar.');
  }
  if (!visit || !code || visit.userId !== uid || code.userId !== uid ||
      visit.requestId !== visitId || code.placeId !== visit.placeId || visit.placeId !== point.placeId ||
      !['confirmed', 'reversed'].includes(visit.status) || visit.status !== code.status) {
    throw new Error('Visita no confirmada o datos incompatibles.');
  }
  return core.normalizeEvidence({
    type: 'confirmed_visit', sourceId: visitId, proofId: null,
    status: visit.status === 'confirmed' ? 'validated' : 'reversed',
    verifiedAt: millis(visit.status === 'reversed' ? visit.reversedAt : visit.confirmedAt)
  });
}

function planConfirmedVisit({ uid, visitId, visit, code, point = core.POINTS.ESTABLISHMENT_B,
  storedEvidence = [], storedEvents = [], profile = null, now }) {
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('Usuario no válido.');
  if (typeof visitId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(visitId)) throw new Error('Visita no válida.');
  if (!Number.isSafeInteger(now) || now <= 0) throw new Error('Fecha de proceso no válida.');
  const incoming = verifiedVisitEvidence(visitId, visit, code, uid, point);
  const incomingKey = core.evidenceKey(incoming);
  const priorEvidence = storedEvidence.find(e => core.evidenceKey(e) === incomingKey);
  if (priorEvidence?.scope === 'tourism_discovery') throw new Error('Evidencia turística: el piloto no puede reutilizarla automáticamente.');
  // Nunca revivir una visita anulada a partir de una petición vieja.
  if (priorEvidence?.status === 'reversed' && incoming.status === 'validated') throw new Error('Visita anulada previamente.');
  const effectiveEvidence = storedEvidence.filter(e => core.evidenceKey(e) !== incomingKey).concat(incoming);
  const result = core.evaluateAdventure(core.PILOT, effectiveEvidence);
  const activeEvents = storedEvents.filter(e => e.status === 'granted' &&
    typeof e.id === 'string' && e.id.startsWith(`${core.PILOT.id}:`))
    .map(e => ({ id: e.id, xp: e.xp, evidenceKey: e.evidenceKey }));
  const delta = core.reconcileXp(activeEvents, result.xpEvents);
  const priorXp = Number(profile?.validatedXp || 0);
  const previousPilotXp = activeEvents.reduce((sum, e) => sum + e.xp, 0);
  const nextXp = priorXp - previousPilotXp + result.xp;
  if (!Number.isSafeInteger(nextXp) || nextXp < 0) throw new Error('Saldo XP inconsistente.');
  const priorBadges = Array.isArray(profile?.publicBadgeIds) ? profile.publicBadgeIds : [];
  const badges = [...new Set(priorBadges.filter(id => id !== core.PILOT.badge.id).concat(result.badgeIds))];
  return {
    evidence: incoming, evidenceChanged: !priorEvidence || priorEvidence.status !== incoming.status || priorEvidence.verifiedAt !== incoming.verifiedAt,
    result, delta,
    profile: {
      publicAlias: profile?.publicAlias || '', participateInRanking: profile?.participateInRanking === true,
      validatedXp: nextXp, level: core.levelForXp(nextXp), publicBadgeIds: badges,
      createdAt: profile?.createdAt || now, updatedAt: now
    }
  };
}

async function syncConfirmedVisit({ db, authenticatedUid, visitId, point = core.POINTS.ESTABLISHMENT_B, now = Date.now() }) {
  // authenticatedUid DEBE derivarse de un token comprobado por el backend, nunca del body.
  if (!db?.runTransaction) throw new Error('Repositorio transaccional necesario.');
  if (typeof authenticatedUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(authenticatedUid) ||
      typeof visitId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(visitId)) throw new Error('Identificadores no válidos.');
  const { profile: base, evidence: evidenceRef, events: eventRef, progress: progressRef } = storage.references(db, authenticatedUid);
  return db.runTransaction(async tx => {
    const visitSnap = await tx.get(db.collection('loyaltyVisits').doc(visitId));
    const codeSnap = await tx.get(db.collection('visitCodes').doc(visitId));
    const profileSnap = await tx.get(base);
    const evidenceSnap = await tx.get(evidenceRef);
    const eventsSnap = await tx.get(eventRef);
    const oldEvents = storage.readEvents(eventsSnap);
    const plan = planConfirmedVisit({ uid: authenticatedUid, visitId, point,
      visit: visitSnap.exists ? visitSnap.data() : null,
      code: codeSnap.exists ? codeSnap.data() : null,
      profile: profileSnap.exists ? profileSnap.data() : null,
      storedEvidence: evidenceSnap.docs.map(doc => doc.data()), storedEvents: oldEvents, now });
    if (!plan.evidenceChanged && !plan.delta.grant.length && !plan.delta.revoke.length) return { changed: false, xp: plan.profile.validatedXp };
    const key = core.evidenceKey(plan.evidence);
    const prior = evidenceSnap.docs.find(doc => core.evidenceKey(doc.data()) === key)?.data();
    tx.set(evidenceRef.doc(documentId(key)), {
      ...plan.evidence, schemaVersion: storage.VERSION, firstVerifiedAt: prior?.firstVerifiedAt || now,
      reversedAt: plan.evidence.status === 'reversed' ? now : null,
      updatedAt: now
    }, { merge: true });
    storage.writeEvents(tx, eventRef, eventsSnap, plan.delta, now);
    tx.set(base, { ...plan.profile, schemaVersion: storage.VERSION }, { merge: true });
    tx.set(progressRef, { schemaVersion: storage.VERSION, availableObjectives: plan.result.availableObjectives, userId: authenticatedUid, adventureId: core.PILOT.id,
      completedObjectives: plan.result.completedObjectives, completed: plan.result.completed,
      xp: plan.result.xp, badgeIds: plan.result.badgeIds, updatedAt: now }, { merge: true });
    tx.create(base.collection('xpAudit').doc(), {
      visitId, evidenceKey: key, grants: plan.delta.grant, revocations: plan.delta.revoke,
      action: plan.evidence.status, processedAt: now
    });
    return { changed: true, xp: plan.profile.validatedXp };
  });
}

module.exports = { documentId, verifiedVisitEvidence, planConfirmedVisit, syncConfirmedVisit };
