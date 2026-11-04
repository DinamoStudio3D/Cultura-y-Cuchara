'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeRewardDraft}=require('../functions/rewards-draft-schema');
const valid={title:'Café gratis',description:'Una bebida',targetVisits:10,validityDays:30,stock:5,rewardType:'product'};
test('creates a draft only and binds it to exact owner and place',()=>{
 const d=normalizeRewardDraft(valid,'local-1','owner-1','SERVER_TIMESTAMP');
 assert.equal(d.status,'draft');assert.equal(d.placeId,'local-1');assert.equal(d.authorUid,'owner-1');
 assert.equal(d.createdAt,d.updatedAt);assert.equal(d.targetVisits,10);
 assert.deepEqual(Object.keys(d).sort(),['placeId','authorUid','status','title','description','targetVisits','validityDays','stock','rewardType','createdAt','updatedAt'].sort());
});
test('never accepts client supplied status, author or timestamps',()=>{
 const d=normalizeRewardDraft({...valid,status:'published',authorUid:'other',createdAt:'old'},'local-1','owner-1','NOW');
 assert.equal(d.status,'draft');assert.equal(d.authorUid,'owner-1');assert.equal(d.createdAt,'NOW');
});
test('rejects invalid ranges and unsafe values',()=>{
 for(const patch of [{targetVisits:9},{targetVisits:31},{targetVisits:10.5},{validityDays:0},{validityDays:366},{stock:-1},{stock:1000001},{stock:1.5},{rewardType:'cash'},{title:'x'}]){
  assert.throws(()=>normalizeRewardDraft({...valid,...patch},'local-1','owner-1','NOW'));
 }
});
test('rejects invalid document IDs and absent server timestamp',()=>{
 assert.throws(()=>normalizeRewardDraft(valid,'other/place','owner-1','NOW'));
 assert.throws(()=>normalizeRewardDraft(valid,'place','owner/other','NOW'));
 assert.throws(()=>normalizeRewardDraft(valid,'place','owner',null));
});
