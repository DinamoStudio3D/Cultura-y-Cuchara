import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('home navigation caches exactly a URL and a Response after stylesheet extraction', async () => {
    const events = new Map(), writes = [];
    const cache = { put: (...args) => { writes.push(args); return Promise.resolve(); } };
    const context = {
        self: { location: { origin: 'https://example.test' }, addEventListener: (name, fn) => events.set(name, fn) },
        caches: { open: async () => cache },
        fetch: async () => new Response('<!doctype html><p>Visita Loja</p>', { headers: { 'content-type': 'text/html' } }),
        URL, Response, Headers,
    };
    vm.runInNewContext(fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8'), context);
    let response;
    events.get('fetch')({ request: { method: 'GET', url: 'https://example.test/', mode: 'navigate' }, respondWith: promise => { response = promise; } });
    assert.equal((await response).status, 200);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes.length, 1);
    assert.equal(writes[0].length, 2);
    assert.equal(writes[0][0], './index.html');
    assert(writes[0][1] instanceof Response);
});
