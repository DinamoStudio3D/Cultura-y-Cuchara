'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {nextRewardStatus,nextClaimStatus,validateMilestoneReward}=require('../functions/rewards-lifecycle-policy');
test('general reward defaults to draft and never consumes stamps',()=>{
 const r=validateMilestoneReward({type:'general',title:'Recuerdo de Loja',terms:'Presentar código',milestone:10,stock:30});
 assert.equal(r.status,'draft');assert.equal(r.consumesStamps,false);assert.equal(r.sponsorId,null);
});
test('sponsored reward requires valid sponsor id',()=>{
 assert.throws(()=>validateMilestoneReward({type:'sponsored',title:'Descuento',milestone:6}),/patrocinador/);
 const r=validateMilestoneReward({type:'sponsored',title:'Descuento',milestone:6,sponsorId:'expreso-al-sur'});
 assert.equal(r.sponsorId,'expreso-al-sur');
});
test('invalid or fractional milestones are rejected',()=>{
 for(const milestone of [0,-1,1.5,1001,'x'])assert.throws(()=>validateMilestoneReward({type:'general',title:'Premio',milestone}));
});
test('general reward cannot impersonate sponsor',()=>assert.throws(()=>validateMilestoneReward({type:'general',title:'Premio',milestone:3,sponsorId:'fake'})));
test('admins can approve and publish in order',()=>{
 assert.equal(nextRewardStatus('draft','approved',{role:'admin'}),'approved');
 assert.equal(nextRewardStatus('approved','published',{role:'admin'}),'published');
});
test('non-admin cannot publish passport rewards',()=>assert.throws(()=>nextRewardStatus('approved','published',{role:'merchant'})));
test('cannot skip approval or republish archived reward',()=>{
 assert.throws(()=>nextRewardStatus('draft','published',{role:'admin'}));
 assert.throws(()=>nextRewardStatus('archived','published',{role:'admin'}));
});
test('redeem requires authorized verifier and cannot be repeated',()=>{
 assert.throws(()=>nextClaimStatus('claimed','redeemed'));
 assert.equal(nextClaimStatus('claimed','redeemed',{authorizedRedeemer:true}),'redeemed');
 assert.throws(()=>nextClaimStatus('redeemed','redeemed',{authorizedRedeemer:true}));
});
test('locked claim cannot jump to redemption',()=>assert.throws(()=>nextClaimStatus('locked','redeemed',{authorizedRedeemer:true})));
test('expired claims cannot be redeemed',()=>assert.throws(()=>nextClaimStatus('expired','redeemed',{authorizedRedeemer:true})));
