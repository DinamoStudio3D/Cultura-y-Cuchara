'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {merchantProgram,merchantBirthday}=require('../functions/merchant-program');
function fixture(role='owner'){
 const records=new Map([
 ['businessAccess/u_place',{active:true,uid:'u',placeId:'place',role}],
 ['missionRewardMerchants/u',{active:true,placeIds:['place']}],
 ['loyaltyPrograms/place',{updatedAt:10,rewardTitle:'Café',rewardDescription:'Condiciones',rewardValidityDays:30,targetVisits:10,maxVisitsPerDay:1,claimedCount:4,stock:8,seasons:[{id:'fiavl',title:'Festival',rewardTitle:'Premio',targetVisits:12,stock:20,startAt:'2026-11-12',endAt:'2026-11-22'}]}]
 ]);
 const db={
  collection(name){return{doc(id){return{path:name+'/'+id}}}},
  runTransaction:async fn=>fn({
   get:async ref=>({exists:records.has(ref.path),data:()=>records.get(ref.path)}),
   update(ref,patch){records.set(ref.path,{...records.get(ref.path),...patch})},
   create(ref,value){assert.equal(records.has(ref.path),false);records.set(ref.path,value)}
  })
 };

 return{records,db,user:{uid:'u'},stamp:11};
}
test('only owner or legacy assigned merchant can configure a reward',async()=>{
 const f=fixture('staff');await assert.rejects(merchantProgram({...f,input:{placeId:'place',action:'load'}}),e=>e.status===403);
 f.records.delete('businessAccess/u_place');assert.equal((await merchantProgram({...f,input:{placeId:'place',action:'load'}})).version,10);
 f.records.get('missionRewardMerchants/u').active=false;await assert.rejects(merchantProgram({...f,input:{placeId:'place',action:'load'}}),e=>e.status===403);
});
test('reward edits preserve stamps targets stock and program state',async()=>{
 const f=fixture();await merchantProgram({...f,input:{placeId:'place',action:'save',version:10,rewardTitle:'Nuevo premio',rewardDescription:'Nuevas condiciones',rewardValidityDays:20,claimedCount:999,targetVisits:1}});
 const p=f.records.get('loyaltyPrograms/place');assert.equal(p.targetVisits,10);assert.equal(p.claimedCount,4);assert.equal(p.stock,8);assert.equal(p.maxVisitsPerDay,1);assert.equal(p.rewardTitle,'Nuevo premio');assert.equal(p.merchantUpdatedBy,'u');
});
test('season edits keep dates stock and other rewards intact',async()=>{
 const f=fixture();await merchantProgram({...f,input:{placeId:'place',action:'save',seasonId:'fiavl',version:10,rewardTitle:'Festival nuevo',rewardDescription:'Condiciones',rewardValidityDays:7}});
 const p=f.records.get('loyaltyPrograms/place');assert.equal(p.rewardTitle,'Café');assert.equal(p.seasons[0].targetVisits,12);assert.equal(p.seasons[0].stock,20);assert.equal(p.seasons[0].startAt,'2026-11-12');assert.equal(p.seasons[0].rewardTitle,'Festival nuevo');
});
test('stale invalid and nonexistent programs do not write',async()=>{
 const f=fixture();const before=JSON.stringify([...f.records]);
 for(const patch of [{version:0},{rewardValidityDays:0},{rewardValidityDays:NaN},{seasonId:'absent'},{rewardTitle:''}])await assert.rejects(merchantProgram({...f,input:{placeId:'place',action:'save',version:10,rewardTitle:'Premio',rewardDescription:'',rewardValidityDays:30,...patch}}));
 assert.equal(JSON.stringify([...f.records]),before);f.records.delete('loyaltyPrograms/place');await assert.rejects(merchantProgram({...f,input:{placeId:'place',action:'load'}}),e=>e.status===412);
});

test('birthday delivery is scoped to the confirmed visit and unique per client place year',async()=>{
 const f=fixture();f.now=Date.parse('2026-11-14T17:00:00Z');
 f.records.set('visitCodes/code',{placeId:'place',status:'confirmed',userId:'client',userName:'Cliente',birthMonthDay:'11-14'});
 f.records.set('birthdayOffers/place',{active:true,title:'Cumpleaños',updatedAt:8,daysBefore:0,daysAfter:0,minimumSpend:10});
 const input={action:'birthday-redeem',placeId:'place',visitId:'code',version:8,confirmed:true,purchaseAmount:10,receiptRef:'',userId:'forged'};
 assert.equal((await merchantBirthday({...f,input:{...input,action:'birthday-load'}})).available,true);
 await assert.rejects(merchantBirthday({...f,input:{...input,purchaseAmount:9}}),e=>e.status===400);
 await assert.rejects(merchantBirthday({...f,input:{...input,version:0}}),e=>e.status===409);
 await merchantBirthday({...f,input});assert.equal(f.records.get('birthdayRedemptions/client_place_2026').userId,'client');
 assert.equal(f.records.has('birthdayRedemptions/forged_place_2026'),false);
 await assert.rejects(merchantBirthday({...f,input}),e=>e.status===409);
});
