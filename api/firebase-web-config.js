'use strict';
const { configuration } = require('./_firebase-environment');
function createHandler(env = process.env) {
  return (req, res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','application/javascript; charset=utf-8');
    res.setHeader('X-Content-Type-Options','nosniff');
    if (req.method !== 'GET') return res.status(405).send('throw new Error("Método no permitido");');
    try {
      const config = configuration(env);
      return res.status(200).send(`window.__VL_FIREBASE_ENV__=Object.freeze(${JSON.stringify(config).replace(/</g,'\\u003c')});`);
    } catch (_) {
      return res.status(503).send('throw new Error("Firebase bloqueado: falta configurar el entorno aislado");');
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
