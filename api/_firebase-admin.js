"use strict";
const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

function credentials(env=process.env){
  const raw=env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON no está configurado.");
  let serviceAccount;
  try { serviceAccount=JSON.parse(raw); } catch (_) { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON no contiene JSON válido."); }
  if(!serviceAccount.project_id||!serviceAccount.client_email||!serviceAccount.private_key) throw new Error("Credencial Firebase incompleta.");
  if(serviceAccount.project_id!=="cultura-y-cuchara") throw new Error("La credencial pertenece a otro proyecto Firebase.");
  return serviceAccount;
}
function app(env=process.env){
  if(getApps().length) return getApps()[0];
  return initializeApp({credential:cert(credentials(env)),projectId:"cultura-y-cuchara"});
}
async function authenticatedUser(req,env=process.env){
  const match=/^Bearer (.+)$/.exec(String(req.headers.authorization||""));
  if(!match) throw Object.assign(new Error("Debes iniciar sesión."),{status:401});
  try { return await getAuth(app(env)).verifyIdToken(match[1],true); }
  catch (_) { throw Object.assign(new Error("La sesión no es válida o caducó."),{status:401}); }
}
function firestore(env=process.env){ return getFirestore(app(env)); }
module.exports={app,authenticatedUser,firestore};
