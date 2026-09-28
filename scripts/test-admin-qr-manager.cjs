/* node scripts/test-admin-qr-manager.cjs: guarda configuración sin mezclar qrCodes. */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../js/admin-qr-manager.js'), 'utf8');
const handlers = {};
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    id, value: '', disabled: false, textContent: '', lastChild: { textContent: '' },
    classList: { contains: () => false, toggle() {} },
    addEventListener(type, callback) { handlers[`${id}.${type}`] = callback; },
    setAttribute() {}, replaceChildren() {}, append() {}
  });
  return elements.get(id);
}
const added = [];
let rejectWrite = false;
const firestore = { collection(name) {
  assert.strictEqual(name, 'staticMarketingQrs');
  return { add: async data => { if (rejectWrite) { const error = new Error('permission denied'); error.code = 'permission-denied'; throw error; } added.push(data); }, doc: () => ({ update: async () => {} }) };
} };
const user = { uid: 'admin-123', email: 'admin@visitaloja.com' };
let current = { url: 'https://www.visitaloja.com/', destinationType: 'home', placeId: '',
  config: { dark: '#000000', light: '#ffffff', margin: 4, level: 'H', size: 1024, logoEnabled: true, logoSize: 18 } };
const context = {
  document: { getElementById: element },
  window: { visitaLojaStaticQr: { snapshot: () => current, validateUrl: value => value } },
  db: firestore, adminView: element('adminView'),
  auth: { currentUser: user, onAuthStateChanged: callback => callback(user) },
  firebase: { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIME' } } },
  MutationObserver: class { observe() {} },
  confirm: () => true,
  Event: class {},
  console
};
vm.runInNewContext(source, context);
(async () => {
  element('staticQrName').value = 'Campaña Loja';
  await handlers['staticQrSave.click']();
  assert.strictEqual(added.length, 1);
  const data = added[0];
  assert.strictEqual(data.name, 'Campaña Loja');
  assert.strictEqual(data.url, 'https://www.visitaloja.com/');
  assert.strictEqual(data.destinationType, 'home');
  assert.strictEqual(data.config.logoEnabled, true);
  assert.strictEqual(data.config.logoSize, 18);
  assert.strictEqual(data.createdByUid, user.uid);
  assert.strictEqual(data.createdByEmail, user.email);
  assert.strictEqual(data.createdAt, 'SERVER_TIME');
  assert.strictEqual(data.updatedAt, 'SERVER_TIME');
  assert.strictEqual(data.status, 'saved');
  assert(!('png' in data) && !('svg' in data));
  element('staticQrName').value = '';
  await handlers['staticQrSave.click']();
  assert.strictEqual(added.length, 1, 'No guarda nombres vacíos');
  rejectWrite = true; element('staticQrName').value = 'Otro QR';
  await handlers['staticQrSave.click']();
  assert.strictEqual(added.length, 1, 'El fallo de permisos no simula un guardado');
  assert.match(element('staticQrSaveState').textContent, /falta publicar la regla/);
  console.log('Gestor: colección aislada, datos, creador, fechas y nombre obligatorio: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
