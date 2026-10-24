'use strict';
// Deploy only with an isolated Firebase project. No listener or deployment is started here.
const Rewards = require('./reward-programs-service.cjs');
const Publication = require('./reward-programs-publication.cjs');
const LIVE_PROJECT = 'cultura-y-cuchara';
const LIVE_HOSTS = new Set(['visitaloja.com', 'www.visitaloja.com']);
function createHandler({ db, projectId, verifyIdToken, allowedOrigins = [], clock = () => Date.now() }) {
  if (!projectId || projectId === LIVE_PROJECT || db?.projectId !== projectId) {
    throw Error('El servicio V2 requiere una base aislada y un proyecto Firebase diferente de producción.');
  }
  if (typeof verifyIdToken !== 'function') throw Error('Falta el verificador de tokens del proyecto aislado.');
  const origins = new Set(allowedOrigins.map(value => {
    const url = new URL(value);
    if (url.origin !== value || url.protocol !== 'https:' || LIVE_HOSTS.has(url.hostname)) {
      throw Error('Configura únicamente orígenes HTTPS de Preview.');
    }
    return value;
  }));
  if (!origins.size) throw Error('Configura al menos un origen de Preview.');
  const authorizeAdmin = async (tx, auth) => {
    if (auth.admin === true || auth.role === 'admin') return true;
    const profile = await tx.get(db.collection('adminUsers').doc(auth.uid));
    return profile.exists && profile.data().active === true && profile.data().role === 'admin';
  };
  const rewards = Rewards.service({ db, clock });
  const publication = Publication.service({ db, authorizeAdmin, clock });
  const actions = {
    'admin/load': (auth) => publication.load(auth),
    'admin/save-draft': (auth, input) => publication.saveDraft(auth, input),
    'admin/publish': (auth, input) => publication.publish(auth, input),
    'customer/catalog': (auth) => rewards.catalog(auth),
    'customer/wallet': (auth) => rewards.wallet(auth),
    'merchant/lookup-claim': (auth, input) => rewards.lookupClaim(auth, input),
    'customer/enroll': (auth, input) => rewards.enroll(auth, input),
    'customer/claim': (auth, input) => rewards.claim(auth, input),
    'merchant/credit-visit': (auth, input) => rewards.creditVisit(auth, input),
    'merchant/reconcile-reversal': (auth, input) => rewards.reconcileReversedCredit(auth, input),
    'merchant/deliver': (auth, input) => rewards.deliver(auth, input)
  };
  return async function handle(request) {
    const origin = request.headers.get('origin');
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'vary': 'Origin' };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (!origins.has(origin)) return reply({ ok: false, error: 'origin-denied' }, 403);
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'POST,OPTIONS';
    headers['access-control-allow-headers'] = 'Authorization,Content-Type';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ ok: false, error: 'method-not-allowed' }, 405);
    const action = new URL(request.url).pathname.replace(/^\/reward-programs-v2\//, '');
    if (!Object.hasOwn(actions, action)) return reply({ ok: false, error: 'not-found' }, 404);
    const bearer = request.headers.get('authorization') || '';
    if (!/^Bearer \S+$/.test(bearer)) return reply({ ok: false, error: 'unauthenticated' }, 401);
    let auth;
    try {
      auth = await verifyIdToken(bearer.slice(7), true);
      if (!auth?.uid || auth.aud !== projectId || auth.iss !== 'https://securetoken.google.com/' + projectId) throw Error();
    } catch (_) { return reply({ ok: false, error: 'unauthenticated' }, 401); }
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) {
      return reply({ ok: false, error: 'json-required' }, 415);
    }
    let input;
    try {
      // Bound the body while reading it, including chunked uploads.
      const reader = request.body?.getReader();
      if (!reader) throw Error();
      const chunks = []; let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 450000) { await reader.cancel(); return reply({ ok: false, error: 'payload-too-large' }, 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      input = JSON.parse(new TextDecoder().decode(bytes));
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error();
    } catch (_) { return reply({ ok: false, error: 'invalid-input' }, 400); }
    try { return reply({ ok: true, data: await actions[action](auth, input) }); }
    catch (error) {
      // Do not expose provider errors, credentials or database paths.
      const conflict = error.code === 'conflict';
      return reply({ ok: false, error: conflict ? 'conflict' : 'operation-rejected' }, conflict ? 409 : 400);
    }
  };
}
module.exports = { createHandler };
