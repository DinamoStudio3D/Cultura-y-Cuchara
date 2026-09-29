'use strict';
const assert = require('node:assert/strict');
const handler = require('./chabaquito-digital');
async function call(method, headers = {}) {
  let status;
  let body;
  await handler({ method, headers }, {
    setHeader() {}, status(code) { status = code; return this; }, json(value) { body = value; return this; }
  });
  return { status, body };
}
(async () => {
  assert.deepEqual(await call('GET'), { status: 503, body: { ready: false } });
  assert.equal((await call('POST')).status, 401);
  assert.equal((await call('PUT')).status, 405);
  console.log('Chabaquito API unavailable without server credentials: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
