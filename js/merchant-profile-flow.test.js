'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('merchant-profile.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g)];
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, {
    value: '', files: [], textContent: '', src: '', innerHTML: '', disabled: false,
    classList: { toggle() {}, add() {}, remove() {} },
    querySelectorAll() { return []; }
  });
  return elements.get(id);
};
const file = (name, type) => ({ name, type, size: 1000 });
const uploads = [];
const updates = [];
let onAuthStateChanged;
let failUpload = false;
const place = { title: 'Negocio de prueba', gallery: [] };
const auth = {
  currentUser: { uid: 'merchant-1' },
  onAuthStateChanged(callback) { onAuthStateChanged = callback; },
  GoogleAuthProvider: class { setCustomParameters() {} }
};
const firestore = {
  collection(name) {
    return {
      doc(id) {
        return {
          async get() {
            if (name === 'missionRewardMerchants') return { exists: true, data: () => ({ active: true, placeIds: ['place-1'] }) };
            assert.equal(name, 'locales');
            assert.equal(id, 'place-1');
            return { exists: true, id, data: () => ({ ...place }) };
          },
          async update(data) { updates.push(data); }
        };
      }
    };
  }
};
function firebase() {}
firebase.initializeApp = () => {};
firebase.auth = () => auth;
firebase.auth.GoogleAuthProvider = auth.GoogleAuthProvider;
firebase.firestore = () => firestore;
firebase.firestore.FieldValue = { serverTimestamp: () => 'timestamp' };
firebase.storage = () => ({
  ref(path) {
    return {
      async put(blob) {
        if (failUpload) throw new Error('Storage no disponible');
        uploads.push({ path, blob });
      },
      async getDownloadURL() { return 'https://storage.test/' + path; }
    };
  }
});

const sandbox = {
  window: { __VL_FIREBASE_ENV__: { mode: 'preview', projectId: 'visitaloja-chabaquito-preview', config: { projectId: 'visitaloja-chabaquito-preview', authDomain: 'visitaloja-chabaquito-preview.firebaseapp.com' } } }, firebase, URL: { createObjectURL: () => 'blob:preview' },
  document: { getElementById: element }, Date, console, Blob, FormData, fetch() {
    throw new Error('Cloudinary debe permanecer apagado');
  }
};
vm.createContext(sandbox);
for (const [, src, inline] of scripts) {
  if (src && (src.startsWith('js/') || src.startsWith('/js/'))) vm.runInContext(fs.readFileSync(src.replace(/^\//, ''), 'utf8'), sandbox, { filename: src });
  else if (inline.trim()) vm.runInContext(inline, sandbox, { filename: 'merchant-profile.html' });
}

(async () => {
  await onAuthStateChanged(auth.currentUser);
  element('place').value = 'place-1';
  element('logoFile').files = [file('logo.png', 'image/png')];
  element('heroFile').files = [file('hero.jpg', 'image/jpeg')];
  element('galleryFiles').files = [file('gallery.webp', 'image/webp')];
  await element('form').onsubmit({ preventDefault() {} });

  assert.equal(uploads.length, 3);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].customLogoUrl, 'https://storage.test/' + uploads[0].path);
  assert.equal(updates[0].heroImage, 'https://storage.test/' + uploads[1].path);
  assert.equal(updates[0].gallery[0].img, 'https://storage.test/' + uploads[2].path);
  assert.equal(updates[0].merchantUpdatedBy, 'merchant-1');
  assert.match(element('message').textContent, /Cambios guardados/);

  failUpload = true;
  element('heroFile').files = [file('failed.jpg', 'image/jpeg')];
  await element('form').onsubmit({ preventDefault() {} });
  assert.equal(updates.length, 1, 'No debe guardar URLs si la subida falla');
  assert.equal(element('save').disabled, false, 'Debe permitir reintentar');
  assert.match(element('message').textContent, /Storage no disponible/);
  console.log('merchant-profile flow: OK (Firebase, URLs guardadas y fallo recuperable)');
})().catch(error => { console.error(error); process.exitCode = 1; });
