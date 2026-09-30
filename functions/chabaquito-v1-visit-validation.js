'use strict';
// Backend adapter only: no HTTP endpoint or production connection.
const { processDiscovery } = require('./chabaquito-v1-discoveries');
const { distanceMeters } = require('./chabaquito-v1-self-visit');
const LIMITS = Object.freeze({ radiusMeters: 15, accuracyMeters: 20, maxAgeMillis: 30000 });
function id(value) { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error('Identificador inválido.'); return value; }
function millis(value) { return value?.toMillis?.() ?? value; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
async function read(tx, db, collection, key) {
  const snap = await tx.get(db.collection(collection).doc(id(key)));
  if (!snap.exists) throw new Error('Documento requerido inexistente.');
  return snap.data();
}
function configuration(place) {
  if (place.active === false || place.discovery?.enabled !== true ||
      !['merchant_confirmation', 'self_checkin', 'both'].includes(place.validationMode)) throw new Error('Parada no habilitada para este descubrimiento.');
  return { mode: place.validationMode, cantonId: id(place.cantonId) };
}
async function processValidatedVisit({ db, authenticatedUid, method, visitId, qrId, coordinates, now = Date.now() }) {
  id(authenticatedUid);
  if (!['staff', 'proximity'].includes(method)) throw new Error('Método inválido.');
  const evidenceId = method === 'staff' ? id(visitId) : `qr_${id(qrId)}`;
  return processDiscovery({ db, authenticatedUid, evidenceId, now,
    loadValidatedEvidence: async ({ tx, uid }) => {
      if (method === 'staff') {
        const visit = await read(tx, db, 'loyaltyVisits', visitId);
        const code = await read(tx, db, 'visitCodes', visitId);
        const place = await read(tx, db, 'locales', visit.placeId);
        const config = configuration(place);
        if (config.mode === 'self_checkin' || visit.userId !== uid || code.userId !== uid ||
            visit.requestId !== visitId || visit.placeId !== code.placeId || visit.status !== code.status ||
            !['confirmed', 'reversed'].includes(visit.status) || code.confirmedBy !== visit.confirmedBy) throw new Error('Confirmación incompatible.');
        const merchant = await read(tx, db, 'missionRewardMerchants', visit.confirmedBy);
        // Equivalent real permission in this branch: active admin-assigned placeIds.
        if (merchant.active !== true || !Array.isArray(merchant.placeIds) || !merchant.placeIds.includes(visit.placeId) ||
            (merchant.role && !['owner', 'manager', 'staff', 'propietario', 'encargado'].includes(merchant.role))) throw new Error('Encargado no autorizado para esta parada.');
        const confirmedAt = millis(visit.confirmedAt), expiresAt = millis(code.expiresAt);
        if (!Number.isSafeInteger(confirmedAt) || !Number.isSafeInteger(expiresAt) || confirmedAt <= 0 || confirmedAt > now || confirmedAt > expiresAt ||
            millis(code.confirmedAt) !== confirmedAt) throw new Error('Confirmación fuera de vigencia.');
        const verifiedAt = millis(visit.status === 'reversed' ? visit.reversedAt : visit.confirmedAt);
        if (!Number.isSafeInteger(verifiedAt) || verifiedAt <= 0 || verifiedAt > now) throw new Error('Fecha de evidencia inválida.');
        return { userId: uid, sourceId: evidenceId, type: 'confirmed_visit', placeId: visit.placeId,
          cantonId: config.cantonId, status: visit.status === 'confirmed' ? 'validated' : 'reversed',
          verifiedAt, validationMethod: 'staff_confirmation' };
      }
      const qr = await read(tx, db, 'qrCodes', qrId);
      if (qr.discoveryEnabled !== true || qr.active !== true) throw new Error('QR no habilitado para descubrimientos.');
      const placeId = id(qr.placeId), place = await read(tx, db, 'locales', placeId), config = configuration(place);
      if (config.mode === 'merchant_confirmation' || place.discovery.qrId !== qrId) throw new Error('QR no asociado o método no permitido.');
      if (!finite(place.lat) || !finite(place.lng) || Math.abs(place.lat) > 90 || Math.abs(place.lng) > 180 ||
          !finite(coordinates?.latitude) || !finite(coordinates?.longitude) || Math.abs(coordinates.latitude) > 90 || Math.abs(coordinates.longitude) > 180 ||
          !finite(coordinates.accuracy) || coordinates.accuracy <= 0 || coordinates.accuracy > LIMITS.accuracyMeters ||
          !Number.isSafeInteger(coordinates.capturedAt) || coordinates.capturedAt > now || now - coordinates.capturedAt > LIMITS.maxAgeMillis) throw new Error('GPS inválido, impreciso o antiguo.');
      if (distanceMeters({ latitude: place.lat, longitude: place.lng }, coordinates) > LIMITS.radiusMeters) throw new Error('Fuera del radio de 15 metros.');
      return { userId: uid, sourceId: evidenceId, type: 'self_visit', placeId, cantonId: config.cantonId,
        status: 'validated', verifiedAt: now, validationMethod: 'self_visit' };
    }
  });
}
module.exports = { LIMITS, configuration, processValidatedVisit };
