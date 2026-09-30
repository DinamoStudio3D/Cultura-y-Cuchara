'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const api = require('./chabaquito-place-config');
const place = { active: true, publicationStatus: 'published', cantonId: 'saraguro', lat: -3.6, lng: -79.2, discovery: { enabled: true, method: 'both', qrId: 'qr-a' } };
const qr = { id: 'qr-a', placeId: 'place-a', active: true, discoveryEnabled: true };
const merchants = [{ active: true, placeIds: ['place-a'] }];
function ready(p = place, q = qr, m = merchants) { return api.readiness({ placeId: 'place-a', place: p, qr: q, merchants: m }); }
test('catálogo16 canónico; antigua/nohabilitada no concedeXP', () => {
  assert.equal(api.CANTONS.length,16); assert.equal(new Set(api.CANTONS.map(c=>c.id)).size,16);
  assert.equal(ready({}).enabled,false); assert.equal(ready({...place,discovery:{...place.discovery,enabled:false}}).enabled,false);
});
test('métodos y requisitos completos', () => {
  assert.equal(ready().enabled,true);
  assert.equal(ready({...place,lat:undefined}).enabled,false);
  assert.equal(ready(place,qr,[]).enabled,false);
  assert.equal(ready({...place,discovery:{...place.discovery,method:'manager'},lat:undefined}).enabled,true);
  assert.equal(ready({...place,discovery:{...place.discovery,method:'proximity'}},qr,[]).enabled,true);
});
test('cantón falso, QR incompatible/inactivo, borrador y permisos ajenos rechazados', () => {
  for(const p of [{...place,cantonId:'inventado'},{...place,publicationStatus:'draft'},{...place,active:false}]) assert.equal(ready(p).enabled,false);
  for(const q of [{...qr,placeId:'other'},{...qr,id:'other'},{...qr,active:false},{...qr,discoveryEnabled:false}]) assert.equal(ready(place,q).enabled,false);
  for(const m of [{active:false,placeIds:['place-a']},{active:true,placeIds:['other']},{active:true,placeIds:['place-a'],role:'visitor'}]) assert.equal(ready(place,qr,[m]).enabled,false);
});
test('Admin bloquea habilitación incompleta y no escribe al comprobar', async () => {
  const fields = Object.fromEntries(['placeForm','chabaquitoPlaceFields','chabaquitoPlaceEnabled','chabaquitoPlaceCanton','chabaquitoPlaceMethod','chabaquitoPlaceQr','chabaquitoPlaceAssociate','chabaquitoPlaceState'].map(id=>[id,{value:'',checked:false}]));
  const context = {
    window: { ChabaquitoPlaceConfig: api },
    document: { readyState:'complete', getElementById: id => fields[id] },
    db: { collection() { return {
      doc() { return { get: async () => ({ exists:true, id:'qr-a', data: () => qr }) }; },
      where() { return { get: async () => ({ docs: merchants.map(m => ({ data: () => m })) }) }; }
    }; } }
  };
  vm.runInNewContext(fs.readFileSync('js/admin-chabaquito-place-config.js','utf8'),context);
  const admin=context.window.ChabaquitoPlaceAdmin;
  admin.load({}); assert.equal((await admin.prepare('',{})).patch.discovery.enabled,false);
  fields.chabaquitoPlaceEnabled.checked=true; await assert.rejects(admin.prepare('',{}),/primero/);
  admin.load(place); assert.equal((await admin.prepare('place-a',place)).readiness.ready,true);
  fields.chabaquitoPlaceCanton.value='inventado'; await assert.rejects(admin.prepare('place-a',place),/cantón/);
});
