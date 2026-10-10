import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
test('legacy upload cannot reach GitHub even with configured credentials and a valid-looking request', async () => {
  let calls = 0, code, body;
  const handler = require('../api/upload-admin-audio.js').createHandler({
    env: { GITHUB_AUDIO_TOKEN: 'fixture' }, fetchImpl: async () => { calls++; throw Error('network forbidden'); },
  });
  for (const method of ['POST', 'GET']) {
    await handler({ method, headers: { authorization: 'Bearer fixture' }, body: Buffer.from('audio'), query: { placeId: 'test', language: 'es', fileName: 'test.mp3' } }, {
      setHeader() {}, status(n) { code = n; return this; }, json(v) { body = v; },
    });
    assert.equal(code, method === 'POST' ? 410 : 405);
    assert.equal(calls, 0);
    assert(!body.commit);
  }
});
function mountAudio() {
  const nodes = new Map();
  class Node {
    constructor() { this.children = []; this.listeners = {}; this.value = ''; this.disabled = false; const classes = new Set(); this.classList = {add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x)}; }
    set id(v) { this._id = v; nodes.set(v, this); } get id() { return this._id; }
    set className(v) { this._className = v; for (const c of v.split(' ')) this.classList.add(c); }
    setAttribute() {} append(...x) { this.children.push(...x); } after(x) { this.afterNode = x; }
    addEventListener(n, f) { this.listeners[n] = f; } dispatchEvent() {} load() {}
    dataset = {};
  }
  for (const id of ['timeAudioUrl','timeAudioUrlEn','timeAudioPreviewEs','timeAudioPreviewEn','timeSaveBtn','timeForm']) { const n = new Node(); n.id = id; }
  let signal;
  const context = { window: {}, document: { readyState: 'complete', getElementById: id => nodes.get(id), createElement: () => new Node(), querySelectorAll: () => [] },
    auth: {currentUser: {getIdToken: async () => 'fixture'}}, AbortController, setTimeout, clearTimeout, Event,
    fetch: async (_url, options) => { signal = options.signal; if (signal.aborted) throw Object.assign(Error('cancelled'), {name: 'AbortError'}); return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(Error('cancelled'), {name: 'AbortError'})))); },
  };
  vm.runInNewContext(readFileSync(new URL('../js/admin-time-audio.js', import.meta.url), 'utf8'), context);
  return {nodes, getSignal: () => signal};
}
test('cancel upload preserves previous audio and unlocks saving; both languages have separate controls', async () => {
  const {nodes, getSignal} = mountAudio();
  const field = nodes.get('timeAudioUrl'); field.value = 'https://example.com/previous.mp3';
  nodes.get('timeAudioFileEs').files = [{name:'new.mp3',type:'audio/mpeg',size:1024}];
  assert(nodes.get('timeAudioCancelEn'));
  const pending = nodes.get('timeAudioUploadEs').listeners.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes.get('timeSaveBtn').disabled, true);
  let prevented = false;
  nodes.get('timeForm').listeners.submit({preventDefault() {prevented=true;}, stopImmediatePropagation() {}});
  assert(prevented);
  nodes.get('timeAudioCancelEs').listeners.click();
  await pending;
  assert(getSignal().aborted);
  assert.equal(field.value, 'https://example.com/previous.mp3');
  assert.equal(nodes.get('timeSaveBtn').disabled, false);
  assert.equal(nodes.get('timeAudioUploadEs').disabled, false);
  assert(nodes.get('timeAudioCancelEs').classList.contains('hidden'));
});
