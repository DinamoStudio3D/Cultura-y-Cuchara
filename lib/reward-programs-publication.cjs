'use strict';
// Server-side adapter. No endpoint is exported and no production connection is made here.
const crypto = require('node:crypto');
const M = require('../js/reward-programs-model');
const revisionId = () => 'r-' + crypto.randomBytes(16).toString('hex');
function service({ db, authorizeAdmin, clock = () => Date.now() }) {
  if (typeof authorizeAdmin !== 'function') throw Error('Se requiere un verificador administrativo del servidor.');
  const settings = db.collection('settings').doc('rewardProgramsPublished');
  const draftRef = uid => db.collection('rewardProgramDraftsV2').doc(uid);
  async function authorize(tx, auth) {
    if (!auth?.uid || auth.uid.includes('/') || !await authorizeAdmin(tx, auth)) {
      throw Error('Tu cuenta no está autorizada para configurar recompensas.');
    }
  }
  function normalize(value) {
    const configuration = M.normalize(value);
    if (Buffer.byteLength(JSON.stringify(configuration), 'utf8') > 400000) {
      throw Error('La configuración supera el tamaño permitido.');
    }
    return configuration;
  }
  function expect(actual, expected) {
    if (typeof expected !== 'string' || actual !== expected) {
      const error = Error('La configuración cambió. Recarga antes de guardar.');
      error.code = 'conflict';
      throw error;
    }
  }
  async function load(auth) {
    return db.runTransaction(async tx => {
      await authorize(tx, auth);
      const [draft, published] = await Promise.all([tx.get(draftRef(auth.uid)), tx.get(settings)]);
      const [places, merchants] = await Promise.all([tx.get(db.collection('locales')), tx.get(db.collection('missionRewardMerchants'))]);
      return { draft: draft.exists ? draft.data() : null, published: published.exists ? published.data() : null,
        places: places.docs.map(doc => ({ ...doc.data(), id: doc.id })),
        merchants: merchants.docs.map(doc => ({ ...doc.data(), id: doc.id })) };
    });
  }
  async function saveDraft(auth, { configuration, expectedRevision }) {
    const value = normalize(configuration);
    return db.runTransaction(async tx => {
      await authorize(tx, auth);
      const ref = draftRef(auth.uid), existing = await tx.get(ref);
      expect(existing.exists ? existing.data().revision : '', expectedRevision);
      const record = { configuration: value, revision: revisionId(), status: 'draft', updatedBy: auth.uid, updatedAt: clock() };
      tx.set(ref, record);
      return record;
    });
  }
  async function publish(auth, { expectedDraftRevision, expectedPublishedRevision }) {
    return db.runTransaction(async tx => {
      await authorize(tx, auth);
      const [draft, published] = await Promise.all([tx.get(draftRef(auth.uid)), tx.get(settings)]);
      if (!draft.exists) throw Error('Guarda primero la configuración.');
      expect(draft.data().revision, expectedDraftRevision);
      expect(published.exists ? published.data().revision : '', expectedPublishedRevision);
      const configuration = normalize(draft.data().configuration);
      const placeIds = new Set([...Object.keys(configuration.programs), ...configuration.passport.placeIds]);
      const prizes = ['local', 'tourist'].flatMap(mode => configuration.passport[mode].rewards.filter(r => r.active));
      const merchantIds = new Set();
      for (const reward of prizes) {
        if (!reward.placeId || reward.placeId.includes('/') || !reward.merchantUid || reward.merchantUid.includes('/')) {
          throw Error('Cada premio del pasaporte necesita una parada y un encargado de entrega.');
        }
        placeIds.add(reward.placeId);
        merchantIds.add(reward.merchantUid);
      }
      // Validate every configured place, even when its program is currently disabled.
      for (const placeId of placeIds) {
        if (!placeId || placeId.includes('/') || !(await tx.get(db.collection('locales').doc(placeId))).exists) {
          throw Error('Una parada de la configuración ya no existe.');
        }
      }
      const merchants = new Map();
      for (const merchantUid of merchantIds) {
        const doc = await tx.get(db.collection('missionRewardMerchants').doc(merchantUid));
        merchants.set(merchantUid, doc.exists ? doc.data() : null);
      }
      for (const reward of prizes) {
        const merchant = merchants.get(reward.merchantUid);
        if (!merchant || merchant.active === false || !(merchant.placeIds || []).includes(reward.placeId)) {
          throw Error('El encargado del premio no tiene acceso activo a su parada de entrega.');
        }
      }
      const record = { configuration, revision: revisionId(), sourceDraftRevision: expectedDraftRevision,
        previousRevision: published.exists ? published.data().revision : '', status: 'published', publishedBy: auth.uid, publishedAt: clock() };
      // Immutable history; existing enrollments keep their own policy snapshots.
      tx.create(db.collection('rewardProgramVersionsV2').doc(record.revision), record);
      tx.set(settings, record);
      return { revision: record.revision, previousRevision: record.previousRevision };
    });
  }
  return { load, saveDraft, publish };
}
module.exports = { service };
