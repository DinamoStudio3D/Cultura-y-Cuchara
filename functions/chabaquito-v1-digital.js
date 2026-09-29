'use strict';
// Lógica del futuro backend: estas respuestas no se cargan en la página pública.
const core = require('../js/chabaquito-v1-core');
const ANSWERS = Object.freeze({ descubre: [0], cultura: [1, 1, 1] });

function validateDigitalAnswer(objectiveId, answers) {
  const expected = ANSWERS[objectiveId];
  if (!expected || !Array.isArray(answers) || answers.length !== expected.length ||
      answers.some(value => value !== null && (!Number.isInteger(value) || value < 0 || value > 2))) {
    throw new Error('Respuestas no válidas.');
  }
  if (objectiveId === 'cultura') return answers.reduce((count, value, index) => count + (value === expected[index] ? 1 : 0), 0) >= 2;
  return answers[0] === expected[0];
}

function digitalEvidence({ objectiveId, answers, uid, existingEvidence = [], verifiedAt }) {
  if (typeof uid !== 'string' || !uid || !['descubre', 'cultura'].includes(objectiveId)) throw new Error('Solicitud no válida.');
  const proofId = objectiveId === 'descubre' ? 'pilot_discover' : 'pilot_culture';
  const sourceId = `pilot_${objectiveId}`;
  if (existingEvidence.some(e => e.type === 'digital_objective' && e.sourceId === sourceId && e.status === 'validated')) {
    return { alreadyCompleted: true, evidence: null };
  }
  const progress = core.evaluateAdventure(core.PILOT, existingEvidence);
  if (!progress.availableObjectives.includes(objectiveId)) throw new Error('Objetivo bloqueado.');
  if (!validateDigitalAnswer(objectiveId, answers)) return { passed: false, alreadyCompleted: false, evidence: null };
  return { passed: true, alreadyCompleted: false, evidence: core.normalizeEvidence({
    type: 'digital_objective', sourceId, proofId, status: 'validated', verifiedAt
  }) };
}

module.exports = { validateDigitalAnswer, digitalEvidence };
