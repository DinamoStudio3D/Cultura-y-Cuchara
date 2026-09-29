'use strict';

// Planificador puro para persistencia idempotente de objetivos digitales V1.
// No conecta Firebase ni concede XP por sí mismo; reutiliza el motor oficial.
const core = require('../js/chabaquito-v1-core');

function cleanUid(value) {
  const uid = String(value ?? '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('Usuario no válido.');
  return uid;
}

function digitalEvidence(objectiveId, verifiedAt) {
  const objective = core.PILOT.objectives.find(item => item.id === objectiveId);
  if (!objective || objective.type !== 'digital') throw new Error('Objetivo digital no válido.');
  if (!Number.isSafeInteger(verifiedAt) || verifiedAt <= 0) throw new Error('Fecha de validación no válida.');
  return core.normalizeEvidence({
    type: 'digital',
    sourceId: objectiveId,
    proofId: null,
    status: 'validated',
    verifiedAt
  });
}

function planDigitalCompletion({ uid, objectiveId, storedEvidence = [], storedEvents = [], profile = null, now }) {
  cleanUid(uid);
  const incoming = digitalEvidence(objectiveId, now);
  const key = core.evidenceKey(incoming);
  const priorEvidence = storedEvidence.find(item => core.evidenceKey(item) === key);

  const effectiveEvidence = storedEvidence
    .filter(item => core.evidenceKey(item) !== key)
    .concat(priorEvidence || incoming);

  const result = core.evaluateAdventure(core.PILOT, effectiveEvidence);
  if (!result.completedObjectives.includes(objectiveId)) {
    throw new Error('El objetivo todavía no está desbloqueado o no puede completarse.');
  }

  const activeEvents = storedEvents
    .filter(event => event.status === 'granted' && typeof event.id === 'string' && event.id.startsWith(`${core.PILOT.id}:`))
    .map(event => ({ id: event.id, xp: event.xp, evidenceKey: event.evidenceKey }));
  const delta = core.reconcileXp(activeEvents, result.xpEvents);
  const priorXp = Number(profile?.validatedXp || 0);
  const previousPilotXp = activeEvents.reduce((sum, event) => sum + event.xp, 0);
  const nextXp = priorXp - previousPilotXp + result.xp;
  if (!Number.isSafeInteger(nextXp) || nextXp < 0) throw new Error('Saldo XP inconsistente.');

  const priorBadges = Array.isArray(profile?.publicBadgeIds) ? profile.publicBadgeIds : [];
  const badges = [...new Set(priorBadges.filter(id => id !== core.PILOT.badge.id).concat(result.badgeIds))];

  return {
    evidence: priorEvidence || incoming,
    evidenceChanged: !priorEvidence,
    result,
    delta,
    profile: {
      publicAlias: profile?.publicAlias || '',
      participateInRanking: profile?.participateInRanking === true,
      validatedXp: nextXp,
      level: core.levelForXp(nextXp),
      publicBadgeIds: badges,
      createdAt: profile?.createdAt || now,
      updatedAt: now
    }
  };
}

module.exports = { digitalEvidence, planDigitalCompletion };
