'use strict';

let cached;

function serviceAccountFromEnv(env = process.env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no está configurado.');
  let account;
  try { account = JSON.parse(raw); } catch (_) { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no contiene JSON válido.'); }
  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error('La cuenta de servicio de Firebase está incompleta.');
  }
  return account;
}

function getAdminDb(env = process.env) {
  if (cached) return cached;
  // firebase-admin is loaded only on the server. Never bundle credentials into client code.
  const admin = require('firebase-admin');
  const account = serviceAccountFromEnv(env);
  const app = admin.apps.length ? admin.app() : admin.initializeApp({
    credential: admin.credential.cert(account),
    projectId: account.project_id
  });
  cached = app.firestore();
  return cached;
}

module.exports = { serviceAccountFromEnv, getAdminDb };
