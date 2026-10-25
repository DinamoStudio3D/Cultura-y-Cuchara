'use strict';
const {test,before,beforeEach,after}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8089')throw Error('Tests require only the local emulator at 127.0.0.1:8089.');
const dependencies=createRequire(path.resolve(process.env.RULES_TEST_NODE_MODULES||path.join(__dirname,'node_modules'),'loader.cjs'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dependencies('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc,Timestamp,serverTimestamp,setLogLevel}=dependencies('firebase/firestore');
setLogLevel('silent');
let env;
const projectId='demo-visitaloja-rules';
before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync(path.resolve(__dirname,'../../firestore.rules'),'utf8')}});});
after(async()=>{if(env)await env.cleanup();});
function actor(uid,role='visitor'){return env.authenticatedContext(uid,{email:uid+'@example.test',admin:role==='admin',role}).firestore();}
const claim=()=>({userId:'customer',campaignId:'campaign',mode:'lojano',optionId:'coffee',merchantUid:'owner',rewardSnapshot:{title:'Café',description:'Una bebida',merchantUid:'owner',active:true},claimCode:'PAS-123456789ABC',status:'pending',completedAt:Timestamp.now()});
beforeEach(async()=>{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore(),time=Timestamp.fromMillis(Date.now()-60000);
  for(const [uid,active]of [['owner',true],['other-owner',true],['suspended',false]])await setDoc(doc(db,'missionRewardMerchants',uid),{active,placeIds:['place'],campaignIds:[],passportGrants:['campaign:lojano']});
  await setDoc(doc(db,'passportCompletions','claim'),claim());
  await setDoc(doc(db,'passportRewardClaimCodes','PAS-123456789ABC'),{completionId:'claim',userId:'customer',campaignId:'campaign',mode:'lojano',optionId:'coffee',merchantUid:'owner'});
  await setDoc(doc(db,'passportCompletions','legacy'),{...claim(),optionId:'',merchantUid:''});
  await setDoc(doc(db,'loyaltyRewardClaims','loyalty'),{userId:'customer',placeId:'place',status:'pending',claimCode:'FID-1234567890ABCDEF',expiresAt:Timestamp.fromMillis(Date.now()+60000),createdAt:time});
  for(const locked of [true,false]){
   const id=locked?'locked':'unlocked';
   await setDoc(doc(db,'loyaltyVisits',id),{requestId:id,userId:'customer',placeId:'place',confirmedBy:'owner',confirmedAt:time,status:'confirmed',...(locked?{passportClaimIds:['claim']}:{})});
   await setDoc(doc(db,'securePassportStamps',id),{requestId:id,userId:'customer',placeId:'place',confirmedBy:'owner',confirmedAt:time});
  }
 });
});
const deliver=()=>({status:'delivered',deliveredAt:serverTimestamp(),deliveredBy:'owner@example.test'});
test('customer reads own passport and cannot read another customer passport',async()=>{await assertSucceeds(getDoc(doc(actor('customer'),'passportCompletions','claim')));await assertFails(getDoc(doc(actor('stranger'),'passportCompletions','claim')));});
test('anonymous users cannot read a passport or its code index',async()=>{const db=env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(db,'passportCompletions','claim')));await assertFails(getDoc(doc(db,'passportRewardClaimCodes','PAS-123456789ABC')));});
test('only the selected active merchant reads the chosen reward and code index',async()=>{for(const collection of ['passportCompletions','passportRewardClaimCodes']){const id=collection==='passportCompletions'?'claim':'PAS-123456789ABC';await assertSucceeds(getDoc(doc(actor('owner'),collection,id)));await assertFails(getDoc(doc(actor('other-owner'),collection,id)));}});
test('suspended selected merchant loses access',async()=>{await env.withSecurityRulesDisabled(async c=>updateDoc(doc(c.firestore(),'missionRewardMerchants','owner'),{active:false}));await assertFails(getDoc(doc(actor('owner'),'passportCompletions','claim')));await assertFails(updateDoc(doc(actor('owner'),'passportCompletions','claim'),deliver()));});
test('client cannot create a passport even with six claimed stamps',async()=>{await assertFails(setDoc(doc(actor('customer'),'passportCompletions','customer_campaign_lojano'),{...claim(),stampsCount:6,completedAt:serverTimestamp()}));});
test('customer and merchant cannot create a code index',async()=>{for(const uid of ['customer','owner'])await assertFails(setDoc(doc(actor(uid),'passportRewardClaimCodes','PAS-OTHER'),{completionId:'claim',campaignId:'campaign',mode:'lojano',userId:'customer'}));});
test('customer cannot replace the chosen option or self-deliver the reward',async()=>{const ref=doc(actor('customer'),'passportCompletions','claim');await assertFails(updateDoc(ref,{optionId:'other'}));await assertFails(updateDoc(ref,deliver()));});
test('selected merchant can deliver once and cannot deliver a second time',async()=>{const ref=doc(actor('owner'),'passportCompletions','claim');await assertSucceeds(updateDoc(ref,deliver()));await assertFails(updateDoc(ref,deliver()));});
test('another merchant with the same campaign grant cannot deliver the chosen reward',async()=>{await assertFails(updateDoc(doc(actor('other-owner'),'passportCompletions','claim'),{...deliver(),deliveredBy:'other-owner@example.test'}));});
test('delivery cannot modify the chosen benefit or forge another actor',async()=>{const ref=doc(actor('owner'),'passportCompletions','claim');await assertFails(updateDoc(ref,{...deliver(),rewardSnapshot:{title:'Otro premio'}}));await assertFails(updateDoc(ref,{...deliver(),deliveredBy:'other-owner@example.test'}));});
test('legacy campaign permissions still permit access to older rewards',async()=>{await assertSucceeds(getDoc(doc(actor('other-owner'),'passportCompletions','legacy')));});
test('administrator can inspect and correct pending rewards',async()=>{const db=actor('administrator','admin');await assertSucceeds(getDoc(doc(db,'passportCompletions','claim')));await assertSucceeds(updateDoc(doc(db,'passportCompletions','claim'),{status:'cancelled'}));});
test('passport claim locks prevent direct visit reversal and stamp deletion',async()=>{const db=actor('owner');await assertFails(updateDoc(doc(db,'loyaltyVisits','locked'),{status:'reversed',reversedAt:serverTimestamp(),reversedBy:'owner'}));await assertFails(deleteDoc(doc(db,'securePassportStamps','locked')));});
test('unclaimed recent visits retain their existing reversal permission',async()=>{await assertSucceeds(updateDoc(doc(actor('owner'),'loyaltyVisits','unlocked'),{status:'reversed',reversedAt:serverTimestamp(),reversedBy:'owner'}));});
test('customer can read loyalty rewards but cannot self-deliver',async()=>{const ref=doc(actor('customer'),'loyaltyRewardClaims','loyalty');await assertSucceeds(getDoc(ref));await assertFails(updateDoc(ref,{status:'delivered',deliveredAt:serverTimestamp(),deliveredBy:'customer',updatedAt:serverTimestamp()}));});
test('assigned merchant can deliver loyalty reward only once',async()=>{const ref=doc(actor('owner'),'loyaltyRewardClaims','loyalty'),patch={status:'delivered',deliveredAt:serverTimestamp(),deliveredBy:'owner',updatedAt:serverTimestamp()};await assertSucceeds(updateDoc(ref,patch));await assertFails(updateDoc(ref,patch));});
test('expired loyalty rewards cannot be delivered through a direct client write',async()=>{await env.withSecurityRulesDisabled(async c=>updateDoc(doc(c.firestore(),'loyaltyRewardClaims','loyalty'),{expiresAt:Timestamp.fromMillis(Date.now()-60000)}));await assertFails(updateDoc(doc(actor('owner'),'loyaltyRewardClaims','loyalty'),{status:'delivered',deliveredAt:serverTimestamp(),deliveredBy:'owner',updatedAt:serverTimestamp()}));});
test('loyalty rewards with unknown expiry require review instead of delivery',async()=>{await env.withSecurityRulesDisabled(async c=>updateDoc(doc(c.firestore(),'loyaltyRewardClaims','loyalty'),{expiresAt:null}));await assertFails(updateDoc(doc(actor('owner'),'loyaltyRewardClaims','loyalty'),{status:'delivered',deliveredAt:serverTimestamp(),deliveredBy:'owner',updatedAt:serverTimestamp()}));});
