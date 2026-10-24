'use strict';
// Preview-only host. This credential is intentionally separate from the live app.
const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { createHandler } = require('./reward-programs-http.cjs');
const firebaseConfig = require('../sandbox/firebase-public-config.json');
const BRANCH = 'feature/reward-configuration';
let app;
function enabled(env) {
  return env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF === BRANCH
    && env.REWARD_SANDBOX_PROJECT_ID === 'vivelojapruebas';
}
function isolatedApp(env) {
  if (app) return app;
  const credential = JSON.parse(env.REWARD_SANDBOX_SERVICE_ACCOUNT_JSON || '{}');
  if (credential.project_id !== 'vivelojapruebas' || !credential.private_key || !credential.client_email) {
    throw Error('sandbox-credential-missing');
  }
  app = getApps().find(value => value.name === 'rewardProgramsSandboxVercel')
    || initializeApp({ projectId: 'vivelojapruebas', credential: cert(credential) }, 'rewardProgramsSandboxVercel');
  if (app.options.projectId !== 'vivelojapruebas') throw Error('sandbox-project-mismatch');
  return app;
}
module.exports = async (req, res) => {
  const env = process.env;
  res.setHeader('Cache-Control', 'no-store');res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!enabled(env)) { res.statusCode = 404;res.end();return; }
  if (req.method === 'GET' && req.query?.config === '1') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ firebase: firebaseConfig, backendConfigured: !!env.REWARD_SANDBOX_SERVICE_ACCOUNT_JSON }));return;
  }
  const role = req.query?.role, operation = req.query?.operation;
  if (typeof role !== 'string' || typeof operation !== 'string' || !/^[a-z-]+$/.test(role) || !/^[a-z-]+$/.test(operation)) { res.statusCode = 404;res.end();return; }
  try {
    const firebase = isolatedApp(env), db = getFirestore(firebase);
    const origin = env.REWARD_SANDBOX_ORIGIN;
    const handler = createHandler({ db, projectId: 'vivelojapruebas', allowedOrigins: [origin], verifyIdToken: (token, revoked) => getAuth(firebase).verifyIdToken(token, revoked) });
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers || {})) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    const options = { method: req.method, headers };
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (req.body !== undefined) options.body = Buffer.isBuffer(req.body) || typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      else { const chunks = [];let bytes = 0;for await (const chunk of req) { bytes += chunk.length;if (bytes > 450000) {res.statusCode = 413;res.end();return;}chunks.push(chunk); }options.body = Buffer.concat(chunks); }
    }
    const response = await handler(new Request(origin + '/reward-programs-v2/' + role + '/' + operation, options));
    res.statusCode = response.status;for (const [key, value] of response.headers) res.setHeader(key, value);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (_) { res.statusCode = 503;res.setHeader('Content-Type', 'application/json');res.end('{"ok":false,"error":"sandbox-not-configured"}'); }
};
