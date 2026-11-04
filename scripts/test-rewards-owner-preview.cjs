'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../rewards-center-owner-preview.html'),'utf8');
const merchant=fs.readFileSync(path.join(__dirname,'../merchant-dashboard.html'),'utf8');
const rules=fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8');

test('owner preview script parses',()=>{
 const script=html.split('<script>')[1]?.split('</script>')[0];
 assert.ok(script);
 assert.doesNotThrow(()=>new vm.Script(script));
});
test('merchant business cards link to the owner editor with exact placeId',()=>{
 assert.match(merchant,/rewards-center-owner-preview\.html\?placeId=/);
 assert.match(merchant,/encodeURIComponent\(place\.id\)/);
});
test('owner authorization checks exact businessAccess document and role',()=>{
 assert.match(html,/doc\(user\.uid\+'_'+placeId\)\.get\(\)/);
 assert.match(html,/data\?\.role!=='owner'/);
 assert.match(html,/data\?\.active!==true/);
 assert.match(html,/data\?\.placeId!==placeId/);
 assert.match(rules,/allow list: if isViveLojaAdmin\(\)/);
});
test('editor does not write to Firestore or publish rewards',()=>{
 assert.doesNotMatch(html,/db\.collection\([^;]*?\.(?:set|update|delete|add)\(/);
 assert.doesNotMatch(html,/\.runTransaction\s*\(/);
 assert.match(html,/sessionStorage\.setItem/);
 assert.match(html,/No se ha publicado/);
});
test('owner import is restricted to selected place and bounded file',()=>{
 assert.match(html,/file\.size>16384/);
 assert.match(html,/data\.placeId!==placeId/);
 assert.match(html,/data\.status!=='draft'/);
 assert.match(html,/data\.targetVisits<10/);
 assert.match(html,/data\.stock>1000000/);
});
test('export does not disclose the owner user identifier',()=>{
 assert.match(html,/schemaVersion:1,placeId:data\.placeId,status:'draft'/);
 assert.doesNotMatch(html,/JSON\.stringify\(\{schemaVersion:1,\.\.\.data\}/);
});

test('editing a draft disables export until saved again',()=>{
 assert.match(html,/el\('draft'\)\.addEventListener\('input',\(\)=>\{showPreview\(\);el\('export'\)\.disabled=true;/);
 assert.match(html,/sessionStorage\.setItem\(key\(placeId\)/);
});
test('restored browser drafts are validated before enabling export',()=>{
 assert.match(html,/Number\.isSafeInteger\(value\.stock\)/);
 assert.match(html,/value\.targetVisits>=10/);
 assert.match(html,/value\.validityDays<=365/);
});
