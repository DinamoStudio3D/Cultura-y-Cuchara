import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
const start = html.indexOf('function qrPlanBenefitsMatchSelection(){');
const end = html.indexOf('function refreshQrMenuPreview()', start);
assert.ok(start >= 0 && end > start, 'La validación del plan QR existe');
const entries = new Map([
  ['qrMenuPlan', { value: 'basic' }],
  ...['Whatsapp', 'Instagram', 'Logo'].map(key => ['qrBenefit' + key, { checked: false }])
]);
const context = {
  document: { getElementById: id => entries.get(id) },
  window: { qrSubscriptionPlanCache: [] }
};
vm.runInNewContext(html.slice(start, end), context);
const check = context.qrPlanBenefitsMatchSelection;

test('El plan básico solo admite beneficios deshabilitados', () => {
  assert.equal(check(), true);
  entries.get('qrBenefitWhatsapp').checked = true;
  assert.equal(check(), false);
  entries.get('qrBenefitWhatsapp').checked = false;
});

test('El plan Plus exige únicamente WhatsApp', () => {
  entries.get('qrMenuPlan').value = 'plus';
  assert.equal(check(), false);
  entries.get('qrBenefitWhatsapp').checked = true;
  assert.equal(check(), true);
  entries.get('qrBenefitLogo').checked = true;
  assert.equal(check(), false);
  entries.get('qrBenefitLogo').checked = false;
});

test('El plan Premium exige exactamente sus tres beneficios', () => {
  entries.get('qrMenuPlan').value = 'premium';
  entries.get('qrBenefitInstagram').checked = true;
  entries.get('qrBenefitLogo').checked = true;
  assert.equal(check(), true);
  entries.get('qrBenefitInstagram').checked = false;
  assert.equal(check(), false);
  entries.get('qrBenefitInstagram').checked = true;
});

test('Los planes comerciales guardados conservan su configuración', () => {
  context.window.qrSubscriptionPlanCache = [{ id: 'cafeteria', benefits: { whatsapp: false, instagram: true, logo: true } }];
  entries.get('qrMenuPlan').value = 'cafeteria';
  assert.equal(check(), false);
  entries.get('qrBenefitWhatsapp').checked = false;
  assert.equal(check(), true);
  entries.get('qrMenuPlan').value = 'plan-no-cargado';
  assert.equal(check(), false);
});

test('Personalizado permite seleccionar beneficios manualmente', () => {
  entries.get('qrMenuPlan').value = 'custom';
  assert.equal(check(), true);
});

test('La validación se ejecuta antes de preparar los datos de guardado', () => {
  const guard = html.indexOf('if(menuEnabled&&!qrPlanBenefitsMatchSelection())');
  const payload = html.indexOf('const data={name,type,targetUrl,design,menuImageUrl:');
  assert.ok(guard >= 0 && guard < payload);
});

test('El visor conserva el menú aunque los extras no estén vigentes', () => {
  const viewer = readFileSync(new URL('../menu-digital.html', import.meta.url), 'utf8');
  const menuLoad = viewer.indexOf('url=data.menuImageUrl;');
  const activeCheck = viewer.indexOf('const activeBenefits=');
  const extras = viewer.indexOf('const benefits=activeBenefits?');
  assert.ok(menuLoad >= 0 && menuLoad < activeCheck && activeCheck < extras);
  assert.ok(viewer.includes("const benefits=activeBenefits?(data.menuBenefits||{}):{}"));
});

test('Vigencia QR: futura, vigente, último día y vencida en horario Ecuador', () => {
  const viewer = readFileSync(new URL('../menu-digital.html', import.meta.url), 'utf8');
  const snippet = viewer.match(/const activeBenefits=\(!start\|\|todayEcuador>=start\)&&\(!expiry\|\|todayEcuador<=expiry\);/);
  assert.ok(snippet, 'El visor comprueba ambas fechas de manera inclusiva');
  const active = new Function('start', 'expiry', 'todayEcuador', snippet[0] + 'return activeBenefits;');
  assert.equal(active('2026-10-14', '2026-11-14', '2026-10-13'), false);
  assert.equal(active('2026-10-13', '2026-11-14', '2026-10-13'), true);
  assert.equal(active('2026-10-01', '2026-10-13', '2026-10-13'), true);
  assert.equal(active('2026-10-01', '2026-10-12', '2026-10-13'), false);
  assert.equal(active(null, null, '2026-10-13'), true);
});

test('El visor vuelve a comprobar beneficios cuando cambia la fecha de Ecuador', () => {
  const viewer = readFileSync(new URL('../menu-digital.html', import.meta.url), 'utf8');
  assert.ok(viewer.includes('const updateExtrasValidity=()=>'));
  assert.ok(viewer.includes("timeZone:'America/Guayaquil'"));
  assert.ok(viewer.includes("window.addEventListener('focus',updateExtrasValidity)"));
  assert.ok(viewer.includes("document.addEventListener('visibilitychange',updateExtrasValidity)"));
  assert.ok(viewer.includes('setInterval(updateExtrasValidity,60000)'));
  assert.ok(viewer.includes('extras.hidden=!allowed||!extras.childElementCount'));
  assert.ok(viewer.includes('logoSlot.hidden=!allowed||!logoSlot.childElementCount'));
});

test('El visor detecta cambios publicados sin regenerar el QR', () => {
  const viewer = readFileSync(new URL('../menu-digital.html', import.meta.url), 'utf8');
  assert.ok(viewer.includes("const publishedSignature=d=>JSON.stringify("));
  assert.ok(viewer.includes("doc(id).get({source:'server'})"));
  assert.ok(viewer.includes('publishedSignature(latest.data())!==initialSignature'));
  assert.ok(viewer.includes("window.addEventListener('focus',refreshPublishedMenu)"));
  assert.ok(viewer.includes("document.addEventListener('visibilitychange',()=>"));
  assert.ok(viewer.includes('if(latest.exists&&publishedSignature(latest.data())!==initialSignature)location.reload()'));
});
