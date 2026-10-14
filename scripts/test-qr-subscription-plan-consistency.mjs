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
