'use strict';
// Read-only transition inspection: never imports, changes counters, or issues rewards.
const crypto = require('node:crypto');
const time = value => Number(value?.toMillis?.() ?? value);
function inspect({ userId, placeId, counter, program, visits = [], claims = [], cutoverAt }) {
  const blockers = [], confirmed = [], seen = new Set();
  const target = Number(program?.targetVisits || 10);
  if (!Number.isSafeInteger(target) || target < 10 || target > 30) blockers.push('legacy-target-invalid');
  if (!Number.isFinite(cutoverAt)) blockers.push('cutover-date-required');
  for (const visit of visits) {
    if (visit.userId !== userId || visit.placeId !== placeId || visit.status !== 'confirmed') continue;
    if (!visit.id || seen.has(visit.id)) { blockers.push('visit-id-invalid-or-duplicate');continue; }
    seen.add(visit.id);
    const at = time(visit.confirmedAt);
    if (!Number.isFinite(at) || !visit.confirmedBy) { blockers.push('visit-origin-unverified');continue; }
    if (at >= cutoverAt) { blockers.push('visit-after-cutover');continue; }
    confirmed.push({ id: visit.id, at });
  }
  confirmed.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const visitCount = Number(counter?.visitCount || 0), rewardCycles = Number(counter?.rewardCycles || 0);
  if (!Number.isSafeInteger(visitCount) || visitCount < 0 || visitCount !== confirmed.length) blockers.push('counter-and-visits-disagree');
  if (!Number.isSafeInteger(rewardCycles) || rewardCycles < 0) blockers.push('reward-cycles-invalid');
  // Do not silently discard an earned but unissued cycle (for example, exhausted stock).
  if (Number.isSafeInteger(target) && rewardCycles !== Math.floor(visitCount / target)) blockers.push('legacy-cycles-need-review');
  const existingClaims = claims.filter(claim => claim.userId === userId && claim.placeId === placeId);
  const claimIds = new Set();
  for (const claim of existingClaims) {
    if (!claim.id || claimIds.has(claim.id)) blockers.push('claim-id-invalid-or-duplicate');
    claimIds.add(claim.id);
    if (!['pending', 'delivered', 'expired'].includes(claim.status)) blockers.push('claim-status-needs-review');
  }
  if (claimIds.size !== rewardCycles) blockers.push('issued-claims-and-cycles-disagree');
  const legacyRemainder = Number.isSafeInteger(target) && target > 0 ? visitCount % target : null;
  const evidence = { userId, placeId, cutoverAt, target, visitCount, rewardCycles, visitIds: confirmed.map(v => v.id), claimIds: [...claimIds].sort() };
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ ...evidence, confirmed, program, counter, claims: existingClaims.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))) })).digest('hex');
  return {
    status: blockers.length ? 'needs-review' : 'evidence-consistent',
    blockers: [...new Set(blockers)], fingerprint, legacyTarget: target, legacyVisitCount: visitCount,
    legacyRemainder, existingClaimIds: evidence.claimIds, verifiedVisitIds: evidence.visitIds,
    // Consistency is not permission to apply new reward thresholds to historical stamps.
    policy: 'preserve-legacy-cycle-and-issued-claims', writesPerformed: false,
    requires: ['verified-export-from-source', 'historical-policy-review', 'coordinated-engine-cutover', 'owner-approval-after-tests']
  };
}
function service({ db, authorizeAdmin }) {
  async function inspectAccount(auth, { userId, placeId, cutoverAt }) {
    if (!auth?.uid || ![userId, placeId].every(value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value))) throw Error('Cuenta o parada inválida.');
    if (!Number.isFinite(cutoverAt)) throw Error('Indica la fecha de corte que se revisará.');
    return db.runTransaction(async tx => {
      if (!await authorizeAdmin(tx, auth)) throw Error('Acceso administrativo requerido.');
      const counterId = (userId + '_' + placeId).replace(/[^a-zA-Z0-9_-]/g, '-');
      const [counter, program, visits, claims] = await Promise.all([
        tx.get(db.collection('loyaltyCounters').doc(counterId)),
        tx.get(db.collection('loyaltyPrograms').doc(placeId)),
        tx.get(db.collection('loyaltyVisits').where('userId', '==', userId)),
        tx.get(db.collection('loyaltyRewardClaims').where('userId', '==', userId))
      ]);
      if (!counter.exists || !program.exists) throw Error('Faltan los datos originales de la tarjeta.');
      return inspect({ userId, placeId, cutoverAt, counter: counter.data(), program: program.data(),
        visits: visits.docs.map(doc => ({ ...doc.data(), id: doc.id })), claims: claims.docs.map(doc => ({ ...doc.data(), id: doc.id })) });
    });
  }
  return { inspectAccount };
}
module.exports = { inspect, service };
