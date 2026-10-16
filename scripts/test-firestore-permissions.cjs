const {test,before,after}=require('node:test');
const {readFileSync}=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const firebase=require('firebase/compat/app');
require('firebase/compat/firestore');
const serverTimestamp=()=>firebase.firestore.FieldValue.serverTimestamp();
const doc=(db,collection,id)=>db.collection(collection).doc(id);
const getDoc=ref=>ref.get();
const setDoc=(ref,data)=>ref.set(data);
const updateDoc=(ref,data)=>ref.update(data);
const storageRef=(db,path)=>db.ref(path);
let env;
const projectId='demo-visitaloja-security';
const auth=(uid,claims={})=>env.authenticatedContext(uid,claims).firestore();
const storageAuth=(uid,claims={})=>env.authenticatedContext(uid,claims).storage();
before(async()=>{
 env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')},storage:{host:'127.0.0.1',port:9199,rules:readFileSync('storage.rules','utf8')}});
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
test('owner cannot assign access or change subscription entitlements',async()=>{
 const db=auth('owner1',{role:'owner'});
 await assertFails(setDoc(doc(db,'businessAccess','owner1_placeB'),{uid:'owner1',placeId:'placeB',role:'owner',active:true}));
 await assertFails(updateDoc(doc(db,'businessEntitlements','placeA'),{maxGalleryImages:100}));
 await assertFails(setDoc(doc(db,'businessEntitlements','placeB'),{maxGalleryImages:100}));
});
test('unrelated user cannot read private subscription entitlement',async()=>{
 await assertFails(getDoc(doc(auth('other'),'businessEntitlements','placeA')));
 await assertSucceeds(getDoc(doc(auth('owner1'),'businessEntitlements','placeA')));
});
test('owner can edit own commercial fields but not another place',async()=>{
 const data={desc:'Nuevo',phone:'',whatsapp:'',hours:'',customLogoUrl:'',heroImage:'',gallery:[],merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner1'};
 await assertSucceeds(updateDoc(doc(auth('owner1'),'locales','placeA'),data));
 await assertFails(updateDoc(doc(auth('owner1'),'locales','placeB'),data));
});
test('legacy description field can be edited by its assigned owner only',async()=>{
 await env.withSecurityRulesDisabled(async context=>{
  await setDoc(doc(context.firestore(),'locales','legacyPlace'),{description:'Descripción anterior',phone:'',whatsapp:'',hours:''});
  await setDoc(doc(context.firestore(),'missionRewardMerchants','legacyOwner'),{active:true,placeIds:['legacyPlace']});
 });
 const update={description:'Descripción actualizada',merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'legacyOwner'};
 await assertSucceeds(updateDoc(doc(auth('legacyOwner'),'locales','legacyPlace'),update));
 await assertFails(updateDoc(doc(auth('other'),'locales','legacyPlace'),{description:'Intrusión',merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'other'}));
 await assertFails(updateDoc(doc(auth('legacyOwner'),'locales','legacyPlace'),{published:false,merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'legacyOwner'}));
});
test('businessAccess owner works without legacy merchant assignment',async()=>{
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await setDoc(doc(db,'businessAccess','owner2_placeB'),{active:true,uid:'owner2',placeId:'placeB',role:'owner'});
 });
 await assertSucceeds(updateDoc(doc(auth('owner2'),'locales','placeB'),{desc:'Propietario autorizado',merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner2'}));
 await assertFails(updateDoc(doc(auth('owner2'),'locales','placeA'),{desc:'Acceso indebido',merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner2'}));
});
test('revoked businessAccess owner cannot edit even with legacy assignment',async()=>{
 await env.withSecurityRulesDisabled(async context=>{
  await updateDoc(doc(context.firestore(),'businessAccess','owner2_placeB'),{active:false});
  await setDoc(doc(context.firestore(),'missionRewardMerchants','owner2'),{active:true,placeIds:['placeB']});
 });
 await assertFails(updateDoc(doc(auth('owner2'),'locales','placeB'),{desc:'No autorizado',merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner2'}));
});
test('owner cannot change administrative publication fields',async()=>{
 await assertFails(updateDoc(doc(auth('owner1'),'locales','placeA'),{published:false,merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner1'}));
});
test('gallery respects business entitlement limit',async()=>{
 const db=auth('owner1');
 await assertSucceeds(updateDoc(doc(db,'locales','placeA'),{gallery:[{img:'a'},{img:'b'}],merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner1'}));
 await assertFails(updateDoc(doc(db,'locales','placeA'),{gallery:[{img:'a'},{img:'b'},{img:'c'}],merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner1'}));
});
test('inactive entitlement cannot grant previous gallery capacity',async()=>{
 await env.withSecurityRulesDisabled(async context=>{
  await updateDoc(doc(context.firestore(),'businessEntitlements','placeA'),{active:false,maxGalleryImages:20});
 });
 const db=auth('owner1');
 await assertSucceeds(updateDoc(doc(db,'locales','placeA'),{gallery:Array.from({length:6},(_,i)=>({img:String(i)})),merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner1'}));
 await assertFails(updateDoc(doc(db,'locales','placeA'),{gallery:Array.from({length:7},(_,i)=>({img:String(i)})),merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner1'}));
});
test('unconfigured business gallery has six-image compatibility cap',async()=>{
 await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'missionRewardMerchants','legacy'),{active:true,placeIds:['placeB']})});
 const db=auth('legacy');
 await assertSucceeds(updateDoc(doc(db,'locales','placeB'),{gallery:Array.from({length:6},(_,i)=>({img:String(i)})),merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'legacy'}));
 await assertFails(updateDoc(doc(db,'locales','placeB'),{gallery:Array.from({length:7},(_,i)=>({img:String(i)})),merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'legacy'}));
});

test('Storage: owner can upload an image only to own business path',async()=>{
 const db=storageAuth('owner1');
 const image=new Uint8Array([137,80,78,71]);
 await assertSucceeds(storageRef(db,'merchants/owner1/placeA/test.png').put(image,{contentType:'image/png'}));
 await assertFails(storageRef(db,'merchants/owner1/placeB/test.png').put(image,{contentType:'image/png'}));
});
test('Storage: revoked owner cannot upload even with legacy assignment',async()=>{
 const db=storageAuth('owner2');
 await assertFails(storageRef(db,'merchants/owner2/placeB/test.png').put(new Uint8Array([137,80,78,71]),{contentType:'image/png'}));
});
test('Storage: wrong account cannot write another owner folder',async()=>{
 await assertFails(storageRef(storageAuth('other'),'merchants/owner1/placeA/test.png').put(new Uint8Array([137,80,78,71]),{contentType:'image/png'}));
});

test('downgraded gallery preserves existing images and allows removal but no additions',async()=>{
 const gallery=Array.from({length:4},(_,i)=>({img:'existing-'+i}));
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await updateDoc(doc(db,'locales','placeA'),{gallery});
  await setDoc(doc(db,'businessEntitlements','placeA'),{maxGalleryImages:2,active:true});
 });
 const place=doc(auth('owner1'),'locales','placeA');
 const update=images=>updateDoc(place,{gallery:images,merchantUpdatedAt:serverTimestamp(),merchantUpdatedBy:'owner1'});
 await assertSucceeds(update(gallery));
 await assertSucceeds(update(gallery.slice(0,3)));
 await assertFails(update([...gallery.slice(0,3),{img:'new-photo'}]));
 await assertFails(update([...gallery,{img:'new-photo'}]));
 await assertSucceeds(update(gallery.slice(0,2)));
});

test('Storage: owner cannot upload unsupported file types or files over 5 MB',async()=>{
 const db=storageAuth('owner1');
 await assertFails(storageRef(db,'merchants/owner1/placeA/document.svg').put(new Uint8Array([60,115,118,103,62]),{contentType:'image/svg+xml'}));
 await assertFails(storageRef(db,'merchants/owner1/placeA/oversize.jpg').put(new Uint8Array(5*1024*1024+1),{contentType:'image/jpeg'}));
});
test('Storage: unauthenticated users cannot upload business images',async()=>{
 const db=env.unauthenticatedContext().storage();
 await assertFails(storageRef(db,'merchants/owner1/placeA/anonymous.png').put(new Uint8Array([1,2,3]),{contentType:'image/png'}));
});
