const {test,before,after}=require('node:test');
const {readFileSync}=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,serverTimestamp}=require('firebase/firestore');
let env;
const projectId='demo-visitaloja-security';
const auth=(uid,claims={})=>env.authenticatedContext(uid,claims).firestore();
before(async()=>{
 env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await setDoc(doc(db,'adminUsers','admin1'),{active:true,role:'admin'});
  await setDoc(doc(db,'adminUsers','owner1'),{active:true,role:'owner'});
  await setDoc(doc(db,'missionRewardMerchants','owner1'),{active:true,placeIds:['placeA']});
  await setDoc(doc(db,'locales','placeA'),{desc:'Anterior',phone:'',whatsapp:'',hours:'',gallery:[]});
  await setDoc(doc(db,'locales','placeB'),{desc:'Anterior',phone:'',whatsapp:'',hours:'',gallery:[]});
  await setDoc(doc(db,'businessAccess','owner1_placeA'),{active:true,uid:'owner1',placeId:'placeA',role:'owner'});
  await setDoc(doc(db,'businessEntitlements','placeA'),{maxGalleryImages:2});
 });
});
after(async()=>{if(env)await env.cleanup()});
test('owner cannot create admin users',async()=>{
 await assertFails(setDoc(doc(auth('owner1',{role:'owner'}),'adminUsers','intruder'),{email:'intruder@example.com',displayName:'Intruder',role:'admin',active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedBy:'owner1'}));
});
test('admin profile can read private business access',async()=>{
 await assertSucceeds(getDoc(doc(auth('admin1'),'businessAccess','owner1_placeA')));
 await assertSucceeds(setDoc(doc(auth('admin1'),'adminUsers','newAdmin'),{email:'admin@example.com',displayName:'Admin',role:'admin',active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedBy:'admin1'}));
});
test('owner can read own business access but not another',async()=>{
 await assertSucceeds(getDoc(doc(auth('owner1'),'businessAccess','owner1_placeA')));
 await assertFails(getDoc(doc(auth('other'),'businessAccess','owner1_placeA')));
});
test('owner can edit own commercial fields but not another place',async()=>{
 const data={desc:'Nuevo',phone:'',whatsapp:'',hours:'',customLogoUrl:'',heroImage:'',gallery:[],merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner1'};
 await assertSucceeds(updateDoc(doc(auth('owner1'),'locales','placeA'),data));
 await assertFails(updateDoc(doc(auth('owner1'),'locales','placeB'),data));
});
test('owner cannot change administrative publication fields',async()=>{
 await assertFails(updateDoc(doc(auth('owner1'),'locales','placeA'),{published:false,merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner1'}));
});
test('gallery respects business entitlement limit',async()=>{
 const db=auth('owner1');
 await assertSucceeds(updateDoc(doc(db,'locales','placeA'),{gallery:[{img:'a'},{img:'b'}],merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner1'}));
 await assertFails(updateDoc(doc(db,'locales','placeA'),{gallery:[{img:'a'},{img:'b'},{img:'c'}],merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner1'}));
});
test('unconfigured business gallery has six-image compatibility cap',async()=>{
 await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'missionRewardMerchants','legacy'),{active:true,placeIds:['placeB']})});
 const db=auth('legacy');
 await assertSucceeds(updateDoc(doc(db,'locales','placeB'),{gallery:Array.from({length:6},(_,i)=>({img:String(i)})),merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'legacy'}));
 await assertFails(updateDoc(doc(db,'locales','placeB'),{gallery:Array.from({length:7},(_,i)=>({img:String(i)})),merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'legacy'}));
});
