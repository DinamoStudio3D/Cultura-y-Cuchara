'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rules=fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8');
function matchBlock(name){
 const start=rules.indexOf('match /'+name+'/{');
 assert.notEqual(start,-1,'Falta regla para '+name);
 const open=rules.indexOf('{',start);
 let depth=0;
 for(let i=open;i<rules.length;i++){
  if(rules[i]==='{')depth++;
  if(rules[i]==='}'&&--depth===0)return rules.slice(start,i+1);
 }
 throw new Error('Bloque de reglas incompleto: '+name);
}
test('businessAccess only permits administrators to assign owner records',()=>{
 const block=matchBlock('businessAccess');
 assert.match(block,/allow create, update, delete: if isViveLojaAdmin\(\)/);
});
test('loyalty programs cannot be created or deleted by staff or owners via client',()=>{
 const block=matchBlock('loyaltyPrograms');
 assert.match(block,/allow create, delete: if isViveLojaAdmin\(\)/);
 assert.match(block,/affectedKeys\(\)\.hasOnly\(\['claimedCount', 'updatedAt'\]\)/);
});
test('passport milestone rules must not be enabled without explicit authorization',()=>{
 const block=matchBlock('loyaltyPrograms');
 assert.doesNotMatch(block,/hasBusinessOwnerAccess\(placeId\)/);
});
