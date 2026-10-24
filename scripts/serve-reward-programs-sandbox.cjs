'use strict';
// Explicit isolated backend host; never starts as part of a production build.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { Readable } = require('node:stream');
const { createHandler } = require('../lib/reward-programs-http.cjs');
const root = path.resolve(__dirname, '..');
async function start() {
  const projectId = process.env.REWARD_SANDBOX_PROJECT_ID;
  const origin = process.env.REWARD_SANDBOX_ORIGIN;
  const publicConfig = JSON.parse(process.env.REWARD_SANDBOX_FIREBASE_CONFIG || '{}');
  if (!projectId || projectId === 'cultura-y-cuchara' || publicConfig.projectId !== projectId || !publicConfig.apiKey || !publicConfig.authDomain) {
    throw Error('Configura un proyecto Firebase aislado y su configuración pública.');
  }
  const preview = new URL(origin);
  if (preview.origin !== origin || preview.protocol !== 'https:' || ['visitaloja.com', 'www.visitaloja.com'].includes(preview.hostname)) {
    throw Error('Configura un origen HTTPS exclusivo de este entorno.');
  }
  // Reuse the existing server dependency package; credentials are provided by the host.
  const serverRequire = createRequire(path.join(root, 'functions/package.json'));
  const { initializeApp, applicationDefault } = serverRequire('firebase-admin/app');
  const { getAuth } = serverRequire('firebase-admin/auth');
  const { getFirestore } = serverRequire('firebase-admin/firestore');
  const app = initializeApp({ projectId, credential: applicationDefault() }, 'rewardProgramsSandbox');
  const db = getFirestore(app);
  const handler = createHandler({ db, projectId, allowedOrigins: [origin], verifyIdToken: (token, revoked) => getAuth(app).verifyIdToken(token, revoked) });
  const assets = new Map([
    ['/', 'sandbox/reward-programs.html'],
    ['/sandbox/reward-programs-bootstrap.js', 'sandbox/reward-programs-bootstrap.js'],
    ...['popup-schedule.js', 'reward-programs-model.js', 'admin-reward-programs.js', 'reward-programs-client.js', 'reward-programs-portal.js'].map(file => ['/js/' + file, 'js/' + file]),
    ['/css/admin-reward-programs.css', 'css/admin-reward-programs.css']
  ]);
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      if (req.method === 'GET' && url.pathname === '/sandbox/config.json') {
        res.setHeader('Content-Type', 'application/json');res.end(JSON.stringify({ firebase: publicConfig }));return;
      }
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const file = assets.get(url.pathname);
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
        res.end(await fs.readFile(path.join(root, file)));return;
      }
      if (!url.pathname.startsWith('/reward-programs-v2/')) { res.writeHead(404);res.end();return; }
      const headers = new Headers();for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      const options = { method: req.method, headers };
      if (!['GET', 'HEAD'].includes(req.method)) { options.body = Readable.toWeb(req);options.duplex = 'half'; }
      const result = await handler(new Request(url, options));
      res.writeHead(result.status, Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
    } catch (_) { if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });res.end('{"ok":false,"error":"internal-error"}'); }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  const port = Number(process.env.REWARD_SANDBOX_PORT || 8788);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Puerto de entorno inválido.');
  server.listen(port, process.env.REWARD_SANDBOX_BIND || '127.0.0.1', () => process.stdout.write('Servidor de beneficios aislado preparado.\n'));
}
start().catch(() => { process.stderr.write('No se pudo iniciar el entorno aislado. Revisa proyecto, origen, dependencias y credenciales del host.\n');process.exitCode = 1; });
