'use strict';
const {normalize} = require('../js/reward-season-fields');
const {createHash} = require('node:crypto');
const {assertPassportEditor} = require('./rewards-center-access');
const {CLAIMS} = require('./rewards-preview-redemption');
const COLLECTION = 'rewardsCenterPassportPrizesPreview';
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const hash = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
const publicPrize = ({title, terms, milestone, expiresAtMs, campaignId, imageUrl}) =>
  ({title, description: terms, targetVisits: milestone, expiresAtMs, campaignId, imageUrl});

function validate(input, now) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const terms = typeof input.terms === 'string' ? input.terms.trim() : '';
  const {kind, sponsor, milestone, stock, expiry} = input;
  if (title.length < 3 || title.length > 100 || terms.length > 400 ||
      !Number.isSafeInteger(milestone) || milestone < 1 || milestone > 1000 ||
      (stock !== null && (!Number.isSafeInteger(stock) || stock < 1 || stock > 1000000)) ||
      !['general', 'sponsored'].includes(kind) || (kind === 'sponsored' && !validId(sponsor))) {
    fail(400, 'Revisa el nombre, la meta, el patrocinador y los cupos.');
  }
  let expiresAtMs = null;
  if (expiry) {
    const ms = typeof expiry === 'string' && /^20\d\d-\d\d-\d\d$/.test(expiry)
      ? Date.parse(expiry + 'T00:00:00-05:00') : NaN;
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== expiry || ms + 86400000 <= now.toMillis()) {
      fail(400, 'La fecha final debe ser válida y estar vigente.');
    }
    expiresAtMs = ms + 86400000;
  }
  let photo;
  try { photo = normalize({imageUrl: input.imageUrl}); }
  catch (error) { fail(400, error.message); }
  return {...photo, title, terms, milestone, remaining: stock, expiresAtMs, placeId: kind === 'sponsored' ? sponsor : null};
}

async function executePassportRewards({db, user, input, now}) {
  const {action, prizeId} = input;
  const prizes = db.collection(COLLECTION);
  if (action === 'passportPublish') {
    const prize = validate(input, now);
    return db.runTransaction(async tx => {
      const roleDb = {collection: name => ({doc: id => ({get: () => tx.get(db.collection(name).doc(id))})})};
      await assertPassportEditor({db: roleDb, user});
      const config = (await tx.get(db.collection('siteContent').doc('passport'))).data();
      if (!validId(config?.campaignId) || config.active === false) fail(409, 'Configura una campaña de pasaporte activa en Firebase de pruebas.');
      if (prize.placeId && !(await tx.get(db.collection('locales').doc(prize.placeId))).exists) fail(400, 'El patrocinador no existe en pruebas.');
      const id = hash(config.campaignId, prize.title.toLowerCase());
      const ref = prizes.doc(id);
      if ((await tx.get(ref)).exists) fail(409, 'Ya existe un premio con ese nombre en esta campaña.');
      tx.create(ref, {...prize, campaignId: config.campaignId, publishedAt: now, publishedBy: user.uid});
      return {prizeId: id};
    });
  }
  if (action === 'passportList') {
    await assertPassportEditor({db, user});
    const snap = await prizes.orderBy('publishedAt', 'desc').limit(50).get();
    return {prizes: snap.docs.map(doc => ({prizeId: doc.id, ...publicPrize(doc.data())}))};
  }
  if (typeof prizeId !== 'string' || !/^[a-f0-9]{64}$/.test(prizeId)) fail(400, 'Premio inválido.');
  const ref = prizes.doc(prizeId);
  if (action === 'passportPrize') {
    const prize = (await ref.get()).data();
    if (!prize) fail(404, 'Premio no encontrado.');
    return {prize: {...publicPrize(prize), prizeId}};
  }
  const claimId = hash('passport', prizeId, user.uid);
  const claimRef = db.collection(CLAIMS).doc(claimId);
  return db.runTransaction(async tx => {
    const existing = await tx.get(claimRef);
    if (existing.exists) return {claim: existing.data()};
    const prize = (await tx.get(ref)).data();
    if (!prize) fail(404, 'Premio no encontrado.');
    if (prize.expiresAtMs !== null && prize.expiresAtMs <= now.toMillis()) fail(409, 'Este premio venció.');
    if (prize.remaining !== null && prize.remaining < 1) fail(409, 'No quedan cupos.');
    const config = (await tx.get(db.collection('siteContent').doc('passport'))).data();
    if (config?.campaignId !== prize.campaignId || config.active === false) fail(409, 'Esta campaña ya no está disponible.');
    const stamps = await tx.get(db.collection('securePassportStamps').where('userId', '==', user.uid).limit(1001));
    if (stamps.size > 1000) fail(409, 'Tu historial requiere revisión.');
    const proofs = stamps.docs.map(doc => doc.data()).filter(stamp =>
      stamp.campaignId === prize.campaignId && stamp.confirmedAt && validId(stamp.placeId) && validId(stamp.requestId));
    const visits = new Map(await Promise.all([...new Set(proofs.map(stamp => stamp.requestId))].map(async id =>
      [id, (await tx.get(db.collection('loyaltyVisits').doc(id))).data()])));
    const stops = new Set();
    for (const stamp of proofs) {
      const visit = visits.get(stamp.requestId);
      if (visit?.userId === user.uid && visit.placeId === stamp.placeId && visit.status === 'confirmed' && visit.confirmedAt) {
        stops.add(stamp.placeId);
      }
    }
    if (stops.size < prize.milestone) fail(409, 'Todavía no alcanzas la meta de sellos en paradas distintas.');
    const claim = {claimId, prizeId, userId: user.uid, placeId: prize.placeId, title: prize.title, status: 'claimed', claimedAt: now, kind: 'passport'};
    tx.create(claimRef, claim);
    if (prize.remaining !== null) tx.update(ref, {remaining: prize.remaining - 1});
    return {claim};
  });
}

module.exports = {executePassportRewards};
