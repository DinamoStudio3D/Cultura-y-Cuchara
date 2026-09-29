'use strict';

const { recordDigitalObjective } = require('../functions/chabaquito-v1-digital-store');

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const ready = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) && process.env.CHABAQUITO_V1_ENABLED === 'true';
  if (req.method === 'GET') return res.status(ready ? 200 : 503).json({ ready });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (req.headers.origin && req.headers.origin !== `https://${req.headers.host}`) return res.status(403).json({ error: 'Origen no autorizado.' });
  const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization || '')?.[1];
  if (!token) return res.status(401).json({ error: 'Inicia sesión para guardar el progreso.' });
  if (!ready) return res.status(503).json({ error: 'La validación persistente aún no está configurada.' });
  try {
    // Las credenciales existen solo en el entorno servidor de Vercel, nunca en el navegador.
    const admin = require('firebase-admin');
    const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (credentials.project_id !== 'cultura-y-cuchara') throw new Error('Proyecto Firebase incorrecto.');
    const app = admin.apps.find(candidate => candidate.name === 'chabaquitoV1') ||
      admin.initializeApp({ credential: admin.credential.cert(credentials) }, 'chabaquitoV1');
    const user = await admin.auth(app).verifyIdToken(token, true);
    if (!user.uid) return res.status(401).json({ error: 'Sesión no válida.' });
    const { objectiveId, answers } = req.body || {};
    if (!['descubre', 'cultura'].includes(objectiveId) || !Array.isArray(answers) || answers.length !== (objectiveId === 'descubre' ? 1 : 3) ||
        answers.some(value => value !== null && (!Number.isInteger(value) || value < 0 || value > 2))) {
      return res.status(400).json({ error: 'Respuestas no válidas.' });
    }
    const result = await recordDigitalObjective({ db: admin.firestore(app), uid: user.uid, objectiveId, answers });
    return res.status(200).json(result);
  } catch (error) {
    if (/auth\/|ID token|Firebase ID token/i.test(error.code || error.message)) return res.status(401).json({ error: 'La sesión ha caducado.' });
    if (/bloqueado|Límite de intentos|Saldo XP inconsistente|Evidencia inconsistente/.test(error.message)) return res.status(409).json({ error: error.message });
    console.error('Chabaquito digital:', error.code || error.message);
    return res.status(503).json({ error: 'No se pudo validar la misión. Inténtalo más tarde.' });
  }
}

module.exports = handler;
