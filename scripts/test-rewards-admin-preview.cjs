'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../rewards-center-admin.html'),'utf8');
test('admin preview uses authenticated admin access guard',()=>{
 assert.match(html,/VisitaLojaAdminAccess\.resolve\(user/);
 assert.match(html,/authorizedUid=user\.uid/);
});
test('draft forms do not write to Firestore',()=>{
 assert.doesNotMatch(html,/db\.collection\([^)]*\)\.(?:add|doc\([^)]*\)\.(?:set|update|delete))\(/);
 assert.match(html,/No se ha publicado ni guardado en Firebase/);
});
test('secondary Firestore queries cannot crash the entire dashboard',()=>{
 assert.match(html,/Promise\.allSettled\(/);
 assert.match(html,/places\?\.docs\|\|\[\]/);
 assert.match(html,/claims\?claims\.size:'—'/);
});
test('drafts are scoped to signed-in user',()=>{
 assert.match(html,/sessionStorage/);
 assert.match(html,/authorizedUid/);
});

test('refresh restores session drafts only once per admin login',()=>{
 assert.match(html,/draftsRestored=false/);
 assert.match(html,/function reset\(\)\{detailRequest\+\+;refreshRequest\+\+;draftsRestored=false/);
 assert.match(html,/if\(!draftsRestored\)\{restoreLocalDraft\(\);restorePassportDraft\(\);draftsRestored=true\}/);
});
test('outdated Firebase responses do not update the panel',()=>{
 assert.match(html,/requestId=\+\+refreshRequest/);
 assert.match(html,/requestId!==refreshRequest/);
});

test('admin preview does not expose any direct Firestore mutation operation',()=>{
 for(const operation of ['set','update','delete','add','batch','runTransaction']){
  assert.doesNotMatch(html,new RegExp('\\.'+operation+'\\s*\\('),'Forbidden write operation: '+operation);
 }
});

test('JSON import and export are local-only, schema checked, and never publish',()=>{
 assert.match(html,/id="exportDraft"/);
 assert.match(html,/id="importDraft"/);
 assert.match(html,/function exportLocalDraft\(\)/);
 assert.match(html,/async function importLocalDraft\(event\)/);
 assert.match(html,/data\.schemaVersion!==1/);
 assert.match(html,/data\.status!=='draft'/);
 assert.match(html,/file\.size>16384/);
 assert.match(html,/No se ha guardado ni publicado en Firebase/);
});

test('draft JSON stock limit matches Firestore and validator',()=>{
 assert.match(html,/id="draftStock"[^>]*max="1000000"/);
 assert.match(html,/stock>1000000/);
 assert.match(html,/data\.stock>1000000/);
});

test('inline admin preview JavaScript parses successfully',()=>{
 const scripts=[...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)].map(match=>match[1]).filter(Boolean);
 assert.equal(scripts.length,1,'Expected one inline application script');
 assert.doesNotThrow(()=>new vm.Script(scripts[0],{filename:'rewards-center-admin-inline.js'}));
});
