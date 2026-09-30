'use strict';

const { configuration } = require('./_firebase-environment');
const cached = new Map();

function serviceAccountFromEnv(env = process.env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no está configurado.');
  let account;
  try { account = JSON.parse(raw); } catch (_) { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no contiene JSON válido.'); }
  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error('La cuenta de servicio de Firebase está incompleta.');
  }
  const target = configuration(env).projectId;
  if (account.project_id !== target) throw new Error('Credenciales administrativas del proyecto equivocado.');
  return account;
}

function getAdminDb(env = process.env) {
  const target = configuration(env).projectId;
  const account = serviceAccountFromEnv(env);
  if (cached.has(target)) return cached.get(target);
  // firebase-admin is loaded only on the server. Never bundle credentials into client code.
  const admin = require('firebase-admin');
  const name = `visitaloja-server-${target}`;
  const app = admin.apps.find(app => app.name === name) || admin.initializeApp({
    credential: admin.credential.cert(account),
    projectId: account.project_id
  }, name);
  if (app.options.projectId !== target) throw new Error('Instancia administrativa de proyecto incorrecto.');
  const db = app.firestore();
  cached.set(target, db);
  return db;
}

module.exports = { serviceAccountFromEnv, getAdminDb };
