import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../js/app-install.js', import.meta.url), 'utf8');
function setup(standalone = false) {
    const events = new Map(), classes = new Set(['hidden']);
    const button = { disabled: false, classList: { add: value => classes.add(value), remove: value => classes.delete(value) } };
    const window = { matchMedia: () => ({ matches: standalone }), addEventListener: (name, fn) => events.set(name, fn) };
    vm.runInNewContext(source, { window, navigator: {}, document: { getElementById: () => button }, console });
    return { window, button, classes, events };
}
test('installation is hidden until the browser offers it, with no automatic prompt', () => {
    const app = setup(); let prompts = 0;
    assert(app.classes.has('hidden'));
    app.events.get('beforeinstallprompt')({ preventDefault() {}, prompt() { prompts++; } });
    assert.equal(prompts, 0);
    assert(!app.classes.has('hidden'));
});
test('dismissed installation is consumed once and never automatically reopened', async () => {
    const app = setup(); let prompts = 0;
    app.events.get('beforeinstallprompt')({ preventDefault() {}, async prompt() { prompts++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    await app.window.requestVisitaLojaInstall();
    await app.window.requestVisitaLojaInstall();
    assert.equal(prompts, 1); assert(app.classes.has('hidden')); assert.equal(app.button.disabled, false);
});
test('duplicate clicks cannot open concurrent prompts', async () => {
    const app = setup(); let prompts = 0, resolve;
    const choice = new Promise(r => { resolve = r; });
    app.events.get('beforeinstallprompt')({ preventDefault() {}, async prompt() { prompts++; }, userChoice: choice });
    const first = app.window.requestVisitaLojaInstall();
    await app.window.requestVisitaLojaInstall();
    assert.equal(prompts, 1); assert.equal(app.button.disabled, true);
    resolve({ outcome: 'accepted' }); await first; assert(app.classes.has('hidden'));
});
test('installed apps hide the action and ignore additional install offers', () => {
    const app = setup(true);
    app.events.get('beforeinstallprompt')({ preventDefault() {} });
    assert(app.classes.has('hidden'));
    app.events.get('appinstalled')(); assert(app.classes.has('hidden'));
});
