'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of fs.readdirSync('.').filter(name => name.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(!/^(<<<<<<<|=======|>>>>>>>)/m.test(html), file);
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/type=["']application\/(?:ld\+)?json/.test(match[1])) continue;
    const src = /src=["']([^"']+)/.exec(match[1])?.[1];
    if (!src && match[2].trim()) new vm.Script(match[2], { filename: file });
    if (src && !/^(https?:|\/api\/)/.test(src)) assert.ok(fs.existsSync(src.replace(/^\//, '')), file + ': ' + src);
  }
}
const index = fs.readFileSync('index.html', 'utf8');
assert.ok(index.includes('id="partnerMarquee"') && index.includes('id="chabaquitoRanking"'));
assert.equal((index.match(/src="js\/chabaquito-v1-persistent.js"/g) || []).length, 1);
assert.ok(!index.includes('src="js/chabaquito-v1-persistence.js"'));
assert.equal(require('../js/visitaloja-image-config').CONFIG.provider, 'firebase');

// Navigation must preserve the visible dashboard and respect cancellation of unsaved changes.
const modules = Object.fromEntries(['dashboard', 'places', 'partners', 'businessAccess'].map(name => [name + 'Module', {
  hidden: name !== 'dashboard', classList: { add() { modules[name + 'Module'].hidden = true; }, remove() { modules[name + 'Module'].hidden = false; } }
}]));
let cancel = false;
const sandbox = { HTMLElement: Object, currentAdminModule: 'dashboard', queueMicrotask: callback => callback(),
  document: { readyState: 'complete', querySelectorAll: () => Object.values(modules), getElementById: id => modules[id] },
  window: { showAdminModule: () => cancel ? false : undefined } };
vm.runInNewContext(fs.readFileSync('js/admin-module-isolation.js', 'utf8'), sandbox);
assert.equal(modules.dashboardModule.hidden, false);
cancel = true;
assert.equal(sandbox.window.showAdminModule('places'), false);
assert.equal(modules.dashboardModule.hidden, false);
assert.equal(modules.placesModule.hidden, true);
cancel = false;
sandbox.window.showAdminModule('partners');
assert.equal(modules.partnersModule.hidden, false);
assert.equal(modules.dashboardModule.hidden, true);

(async () => {
  let status;
  await require('../api/delete-merchant-image').createHandler({ env: { VERCEL_ENV: 'preview' },
    fetchImpl: () => { throw new Error('No external request allowed'); }
  })({ method: 'POST', headers: {} }, { setHeader() {}, status(value) { status = value; return this; }, json() {} });
  assert.equal(status, 503);
  console.log('Integrated Preview: HTML/JS, assets, single XP client, Firebase images, navigation and Cloudinary isolation OK.');
})().catch(error => { console.error(error); process.exitCode = 1; });
