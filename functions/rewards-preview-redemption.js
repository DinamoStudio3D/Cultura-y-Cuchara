'use strict';

const {createHash} = require('node:crypto');
const PRIZES = 'rewardsCenterPrizesPreview';
const CLAIMS = 'rewardsCenterClaimsPreview';
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const pairId = (first, second) => createHash('sha256').update(JSON.stringify([first, second])).digest('hex');

function publishPreviewPrize({db, tx, draftRef, draft, now}) {
  if (draft.stock < 1) fail(409, 'El premio necesita al menos un cupo para publicarse.');
  const prizeId = pairId(draftRef.id, draft.revision);
  const expiresAt = new Date(now.toMillis() + draft.validityDays * 86400000);
  tx.set(db.collection(PRIZES).doc(prizeId), {
    prizeId, placeId: draft.placeId, title: draft.title, description: draft.description,
    rewardType: draft.rewardType, targetVisits: draft.targetVisits,
    stock: draft.stock, remaining: draft.stock, publishedAt: now, expiresAt
  });
  return prizeId;
}

async function claimPreviewPrize({db, user, prizeId, now}) {
  if (typeof prizeId !== 'string' || !/^[a-f0-9]{64}$/.test(prizeId)) fail(400, 'Premio inválido.');
  const prizeRef = db.collection(PRIZES).doc(prizeId);
  const claimId = pairId(prizeId, user.uid);
  const claimRef = db.collection(CLAIMS).doc(claimId);
  return db.runTransaction(async tx => {
    const existing = await tx.get(claimRef);
    if (existing.exists) return {claim: existing.data()};
    const prize = (await tx.get(prizeRef)).data();
    if (!prize) fail(404, 'Premio no encontrado.');
    if (prize.expiresAt.toMillis() <= now.toMillis()) fail(409, 'Este premio venció.');
    if (!Number.isSafeInteger(prize.remaining) || prize.remaining < 1) fail(409, 'No quedan cupos.');
    const matches = await tx.get(db.collection('loyaltyCounters')
      .where('userId', '==', user.uid).where('placeId', '==', prize.placeId).limit(2));
    const visits = matches.size === 1 ? matches.docs[0].data().visitCount : 0;
    if (!Number.isSafeInteger(visits) || visits < prize.targetVisits) fail(409, 'Todavía no alcanzas los sellos requeridos.');
    const claim = {claimId, prizeId, placeId: prize.placeId, title: prize.title, status: 'claimed', claimedAt: now};
    tx.set(claimRef, {...claim, userId: user.uid});
    tx.update(prizeRef, {remaining: prize.remaining - 1});
    return {claim: {...claim, userId: user.uid}};
  });
}

async function deliverPreviewPrize({db, user, claimId, placeId, now}) {
  if (typeof claimId !== 'string' || !/^[a-f0-9]{64}$/.test(claimId)) fail(400, 'Referencia inválida.');
  return db.runTransaction(async tx => {
    const profile = (await tx.get(db.collection('adminUsers').doc(user.uid))).data();
    const admin = (profile?.active === true && profile.role === 'admin') || user.admin === true || user.role === 'admin';
    if (!admin) {
      const assignment = (await tx.get(db.collection('missionRewardMerchants').doc(user.uid))).data();
      if (typeof placeId !== 'string' || assignment?.active !== true ||
          !Array.isArray(assignment.placeIds) || !assignment.placeIds.includes(placeId)) {
        fail(403, 'Tu cuenta no está autorizada para confirmar entregas en esta parada.');
      }
    }
    const ref = db.collection(CLAIMS).doc(claimId);
    const claim = (await tx.get(ref)).data();
    if (!claim || (!admin && claim.placeId !== placeId)) fail(404, 'Canje no encontrado para esta parada.');
    const receipt = ({title, status, deliveredAt}) => ({title, status, deliveredAt});
    if (claim.status === 'delivered') return {claim: receipt(claim), alreadyDelivered: true};
    if (claim.status !== 'claimed') fail(409, 'El canje no está pendiente de entrega.');
    const next = {...claim, status: 'delivered', deliveredAt: now, deliveredBy: user.uid};
    tx.set(ref, next);
    return {claim: receipt(next), alreadyDelivered: false};
  });
}

module.exports = {PRIZES, CLAIMS, publishPreviewPrize, claimPreviewPrize, deliverPreviewPrize};
