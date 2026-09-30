'use strict';
// Validador puro para backend futuro. NO se importa en frontend ni genera QR físicos.
const core = require('../js/chabaquito-v1-core');
const OBJECTIVE = Object.freeze({ POINT_A: 'autonoma-uno', POINT_C: 'autonoma-dos' });

function distanceMeters(a, b) {
  const radians = degrees => degrees * Math.PI / 180;
  const deltaLat = radians(b.latitude - a.latitude);
  const deltaLng = radians(b.longitude - a.longitude);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(deltaLng / 2) ** 2;
  const bounded = Math.min(1, Math.max(0, h));
  return 6371000 * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

function validateSelfVisit({ uid, marker, point, coordinates, existingEvidence = [], verifiedAt }) {
  if (typeof uid !== 'string' || !uid || !point || !marker ||
      !OBJECTIVE[point.id] || marker.pointId !== point.id || marker.active !== true || point.active !== true ||
      typeof marker.id !== 'string' || !/^[A-Za-z0-9_-]{12,128}$/.test(marker.id)) {
    throw new Error('Punto o QR no habilitado.');
  }
  const objective = OBJECTIVE[point.id];
  const sourceId = `pilot_${point.id}`;
  if (existingEvidence.some(e => e.type === 'self_visit' && e.sourceId === sourceId && e.status === 'validated')) {
    return { alreadyCompleted: true, evidence: null };
  }
  if (!core.evaluateAdventure(core.PILOT, existingEvidence).availableObjectives.includes(objective)) {
    throw new Error('Objetivo bloqueado.');
  }
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  if (!finite(point.latitude) || !finite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 ||
      !finite(point.radiusMeters) || point.radiusMeters <= 0 || !finite(point.maxAccuracyMeters) || point.maxAccuracyMeters <= 0 ||
      !finite(coordinates?.latitude) || !finite(coordinates?.longitude) || Math.abs(coordinates.latitude) > 90 ||
      Math.abs(coordinates.longitude) > 180 || !finite(coordinates.accuracyMeters) || coordinates.accuracyMeters < 0) {
    throw new Error('Ubicación o configuración no válida.');
  }
  const distance = distanceMeters(point, coordinates);
  if (coordinates.accuracyMeters > point.maxAccuracyMeters || distance > point.radiusMeters) {
    return { passed: false, alreadyCompleted: false, evidence: null, reason: 'outside_or_inaccurate' };
  }
  // Solo se persiste el resultado, jamás coordenadas exactas del visitante.
  return { passed: true, alreadyCompleted: false, evidence: core.normalizeEvidence({
    type: 'self_visit', sourceId, proofId: point.id === 'POINT_A' ? 'pilot_self_one' : 'pilot_self_two',
    status: 'validated', verifiedAt
  }) };
}

module.exports = { distanceMeters, validateSelfVisit };
