'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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
