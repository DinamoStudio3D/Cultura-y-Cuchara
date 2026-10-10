'use strict';
const crypto = require('node:crypto');
class LoyaltyError extends Error { constructor(code,message){super(message);this.code=code;} }
const fail=(code,message)=>{throw new LoyaltyError(code,message);};
function id(value){if(typeof value!=='string'||!value||value.length>180||value.includes('/'))fail('invalid-argument','Identificador inválido.');return value;}
const key=(...parts)=>crypto.createHash('sha256').update(JSON.stringify(parts.map(id))).digest('hex');
function integer(value,min=0,max=1000000000){if(!Number.isSafeInteger(value)||value<min||value>max)fail('invalid-argument','Cantidad inválida.');return value;}
const settingsRef=db=>db.collection('settings').doc('loyaltyV83');
function enabled(settings){if(settings?.enabled!==true)fail('failed-precondition','Puntos y seguidores todavía no están habilitados.');}
async function manager(tx,db,actor,placeId){
 if(!actor?.uid)fail('unauthenticated','Inicia sesión.');
 const [admin,merchant]=await Promise.all([tx.get(db.collection('adminUsers').doc(actor.uid)),tx.get(db.collection('missionRewardMerchants').doc(actor.uid))]);
 const profile=admin.exists?admin.data():{},claims=actor.token||{};
 const isAdmin=claims.admin===true||['admin','owner'].includes(claims.role)||claims.email==='sukogames1996@gmail.com'||profile.active===true&&['admin','owner'].includes(profile.role);
 const m=merchant.exists?merchant.data():{};
 if(!isAdmin&&(m.active===false||!Array.isArray(m.placeIds)||!m.placeIds.includes(placeId)))fail('permission-denied','Parada no autorizada.');
 return isAdmin;
}
function accountData(account,userId,placeId){if(account&&(account.userId!==userId||account.placeId!==placeId))fail('failed-precondition','Cuenta de puntos inconsistente.');return {userId,placeId,balance:integer(account?.balance??0),earned:integer(account?.earned??0),spent:integer(account?.spent??0)};}
function configData(raw,max=50){if(typeof raw.enabled!=='boolean'||typeof raw.ownerCanConfigure!=='boolean')fail('invalid-argument','Controles inválidos.');return {enabled:raw.enabled===true,ownerCanConfigure:raw.ownerCanConfigure===true,pointsPerStamp:integer(raw.pointsPerStamp,1,integer(max,1,1000))};}
function rewardData(raw){const title=String(raw.title||'').trim(),conditions=String(raw.conditions||'').trim();if(!title||title.length>100||conditions.length>400)fail('invalid-argument','Beneficio inválido.');return {title,conditions,cost:integer(raw.cost,1,1000000),stock:raw.stock==null?null:integer(raw.stock,0,1000000),active:raw.active===true,validityDays:integer(raw.validityDays??30,1,365)};}
// These helpers participate in the SAME transaction as the confirmed/reversed stamp.
async function prepareAward({tx,db,userId,placeId,requestId,now}){
 const gate=await tx.get(settingsRef(db));if(!gate.exists||gate.data().enabled!==true)return null;
 const program=await tx.get(db.collection('loyaltyPointPrograms').doc(id(placeId)));if(!program.exists||program.data().enabled!==true)return null;
 const amount=integer(program.data().pointsPerStamp,1,integer(gate.data().maxPointsPerStamp??50,1,1000)),accountRef=db.collection('loyaltyPointAccounts').doc(key(userId,placeId)),ledgerRef=db.collection('loyaltyPointLedger').doc(key('stamp',requestId));
 const [a,l]=await Promise.all([tx.get(accountRef),tx.get(ledgerRef)]);if(l.exists)fail('already-exists','Este sello ya tiene puntos.');
 const account=accountData(a.exists?a.data():null,userId,placeId);integer(account.balance+amount);integer(account.earned+amount);
 return {amount,apply(){tx.set(accountRef,{...account,balance:account.balance+amount,earned:account.earned+amount,updatedAt:now});tx.create(ledgerRef,{userId,placeId,requestId,type:'stamp',delta:amount,createdAt:now});}};
}
async function prepareReversal({tx,db,visit,requestId,now}){
 const amount=integer(visit.pointsEarned??0);if(!amount)return null;
 const accountRef=db.collection('loyaltyPointAccounts').doc(key(visit.userId,visit.placeId)),ledgerRef=db.collection('loyaltyPointLedger').doc(key('stamp',requestId)),reverseRef=db.collection('loyaltyPointLedger').doc(key('reverse',requestId));
 const [a,l,r]=await Promise.all([tx.get(accountRef),tx.get(ledgerRef),tx.get(reverseRef)]);
 if(!a.exists||!l.exists||r.exists||l.data().delta!==amount||l.data().userId!==visit.userId||l.data().placeId!==visit.placeId)fail('failed-precondition','Movimiento de puntos inconsistente.');
 const account=accountData(a.data(),visit.userId,visit.placeId);if(account.balance<amount||account.earned<amount)fail('failed-precondition','Los puntos del sello ya se utilizaron. Cancela primero el canje pendiente o solicita revisión administrativa.');
 return {amount,apply(){tx.set(accountRef,{...account,balance:account.balance-amount,earned:account.earned-amount,updatedAt:now});tx.create(reverseRef,{userId:visit.userId,placeId:visit.placeId,requestId,type:'reverse',delta:-amount,createdAt:now});}};
}
function service({db,clock=()=>Date.now(),timestamp=value=>value}){
 const now=()=>timestamp(clock());
 async function context(tx,actor,placeId,manage=false){if(!actor?.uid)fail('unauthenticated','Inicia sesión.');id(actor.uid);id(placeId);const gate=await tx.get(settingsRef(db));enabled(gate.data());const isAdmin=manage?await manager(tx,db,actor,placeId):false;return {settings:gate.data(),isAdmin};}
 async function configure(actor,data){const placeId=id(data.placeId);return db.runTransaction(async tx=>{
  const {settings,isAdmin}=await context(tx,actor,placeId,true),ref=db.collection('loyaltyPointPrograms').doc(placeId);
  const [existing,place]=await Promise.all([tx.get(ref),tx.get(db.collection('locales').doc(placeId))]);if(!place.exists)fail('not-found','La parada no existe.');
  if(!isAdmin&&existing.data()?.ownerCanConfigure!==true)fail('permission-denied','El administrador debe habilitar la configuración.');
  const config=configData(data,settings.maxPointsPerStamp??50);
  if(!isAdmin){config.enabled=existing.data().enabled===true;config.ownerCanConfigure=existing.data().ownerCanConfigure===true;}
  tx.set(ref,{...config,placeId,updatedBy:actor.uid,updatedAt:now()});return config;
 });}
 async function saveReward(actor,data){const placeId=id(data.placeId),rewardId=id(data.rewardId),value=rewardData(data);return db.runTransaction(async tx=>{
  const {isAdmin}=await context(tx,actor,placeId,true),program=await tx.get(db.collection('loyaltyPointPrograms').doc(placeId));
  if(!program.exists||!isAdmin&&program.data().ownerCanConfigure!==true)fail('permission-denied','Configuración no autorizada.');
  const ref=db.collection('loyaltyPointRewards').doc(key(placeId,rewardId)),old=await tx.get(ref),issued=integer(old.data()?.issued??0);
  if(value.stock!==null&&value.stock<issued)fail('failed-precondition','El stock no puede ser menor que las reservas y entregas.');
  tx.set(ref,{...value,issued,placeId,rewardId,updatedBy:actor.uid,updatedAt:now()});return {rewardId,...value,issued};
 });}
 async function redeem(actor,data){const placeId=id(data.placeId),rewardId=id(data.rewardId),requestId=id(data.requestId);if(!actor?.uid)fail('unauthenticated','Inicia sesión.');return db.runTransaction(async tx=>{
  await context(tx,actor,placeId);const claimRef=db.collection('loyaltyPointClaims').doc(key(actor.uid,placeId,requestId)),accountRef=db.collection('loyaltyPointAccounts').doc(key(actor.uid,placeId)),rewardRef=db.collection('loyaltyPointRewards').doc(key(placeId,rewardId));
  const [c,a,r,p]=await Promise.all([tx.get(claimRef),tx.get(accountRef),tx.get(rewardRef),tx.get(db.collection('loyaltyPointPrograms').doc(placeId))]);
  if(c.exists){if(c.data().rewardId!==rewardId)fail('already-exists','La solicitud corresponde a otro beneficio.');return {claimId:claimRef.id,...c.data()};}
  if(!p.exists||p.data().enabled!==true||!r.exists||r.data().active!==true)fail('failed-precondition','Beneficio no disponible.');
  const reward=rewardData(r.data()),issued=integer(r.data().issued??0),account=accountData(a.exists?a.data():null,actor.uid,placeId);
  if(account.balance<reward.cost)fail('failed-precondition','Puntos insuficientes.');if(reward.stock!==null&&issued>=reward.stock)fail('resource-exhausted','Beneficio agotado.');
  integer(account.spent+reward.cost);const at=now(),expiresAt=timestamp(clock()+reward.validityDays*86400000),claim={userId:actor.uid,placeId,rewardId,title:reward.title,conditions:reward.conditions,cost:reward.cost,status:'pending',createdAt:at,expiresAt};
  tx.set(accountRef,{...account,balance:account.balance-reward.cost,spent:account.spent+reward.cost,updatedAt:at});tx.update(rewardRef,{issued:issued+1});tx.create(claimRef,claim);tx.create(db.collection('loyaltyPointLedger').doc(key('redeem',claimRef.id)),{userId:actor.uid,placeId,claimId:claimRef.id,type:'redeem',delta:-reward.cost,createdAt:at});return {claimId:claimRef.id,...claim};
 });}
 async function settle(actor,data){const claimId=id(data.claimId),action=data.action;if(!['deliver','cancel'].includes(action))fail('invalid-argument','Acción inválida.');return db.runTransaction(async tx=>{
  if(!actor?.uid)fail('unauthenticated','Inicia sesión.');const ref=db.collection('loyaltyPointClaims').doc(claimId),snap=await tx.get(ref);if(!snap.exists)fail('not-found','Canje no encontrado.');const claim=snap.data();
  // Clients may cancel only their own pending claim, even while the feature is paused.
  if(action==='deliver'||actor.uid!==claim.userId)await manager(tx,db,actor,claim.placeId);
  if(action==='deliver'){const gate=await tx.get(settingsRef(db));enabled(gate.data());}
  const next=action==='deliver'?'delivered':'cancelled';if(claim.status===next)return {status:next};if(claim.status!=='pending')fail('failed-precondition','El canje ya fue procesado.');
  const expires=claim.expiresAt?.toMillis?.()??claim.expiresAt;if(action==='deliver'&&clock()>=expires)fail('deadline-exceeded','Canje vencido. Cancélalo para devolver puntos.');
  const at=now();if(action==='cancel'){
   const accountRef=db.collection('loyaltyPointAccounts').doc(key(claim.userId,claim.placeId)),rewardRef=db.collection('loyaltyPointRewards').doc(key(claim.placeId,claim.rewardId));const [a,r]=await Promise.all([tx.get(accountRef),tx.get(rewardRef)]);
   const account=accountData(a.data(),claim.userId,claim.placeId),cost=integer(claim.cost,1);integer(account.balance+cost);if(account.spent<cost||!r.exists||integer(r.data().issued??0)<1)fail('failed-precondition','No se puede reconciliar el canje.');
   tx.set(accountRef,{...account,balance:account.balance+cost,spent:account.spent-cost,updatedAt:at});tx.update(rewardRef,{issued:r.data().issued-1});tx.create(db.collection('loyaltyPointLedger').doc(key('refund',claimId)),{userId:claim.userId,placeId:claim.placeId,claimId,type:'refund',delta:cost,createdAt:at});
  }
  tx.update(ref,{status:next,processedBy:actor.uid,processedAt:at});return {status:next};
 });}
 async function follow(actor,data){if(!actor?.uid)fail('unauthenticated','Inicia sesión.');const placeId=id(data.placeId);if(typeof data.active!=='boolean'||typeof data.promotions!=='boolean'||typeof data.birthdays!=='boolean')fail('invalid-argument','Preferencias inválidas.');return db.runTransaction(async tx=>{
  const ref=db.collection('loyaltyFollows').doc(key(actor.uid,placeId)),gate=await tx.get(settingsRef(db));
  if(data.active)enabled(gate.data());const [place,old]=await Promise.all([tx.get(db.collection('locales').doc(placeId)),tx.get(ref)]);if(data.active&&!place.exists)fail('not-found','Parada no encontrada.');const at=now();
  const value={userId:actor.uid,placeId,active:data.active,promotions:data.active&&data.promotions,birthdays:data.active&&data.birthdays,pushConsent:false,consentVersion:1,updatedAt:at,createdAt:old.data()?.createdAt??at};tx.set(ref,value);return value;
 });}
 async function wallet(actor,data){if(!actor?.uid)fail('unauthenticated','Inicia sesión.');const placeId=id(data.placeId),gate=await settingsRef(db).get();enabled(gate.data());
  const [account,program,following,rewards,claims,ledger]=await Promise.all([db.collection('loyaltyPointAccounts').doc(key(actor.uid,placeId)).get(),db.collection('loyaltyPointPrograms').doc(placeId).get(),db.collection('loyaltyFollows').doc(key(actor.uid,placeId)).get(),db.collection('loyaltyPointRewards').where('placeId','==',placeId).where('active','==',true).limit(50).get(),db.collection('loyaltyPointClaims').where('userId','==',actor.uid).where('placeId','==',placeId).limit(100).get(),db.collection('loyaltyPointLedger').where('userId','==',actor.uid).where('placeId','==',placeId).limit(100).get()]);
  return {account:accountData(account.data(),actor.uid,placeId),program:program.data()||null,following:following.data()||null,rewards:rewards.docs.map(s=>s.data()),claims:claims.docs.map(s=>({claimId:s.id,...s.data()})),ledger:ledger.docs.map(s=>s.data())};
 }
 async function overview(actor,data){const placeId=id(data.placeId);await db.runTransaction(async tx=>{await context(tx,actor,placeId,true);});const [p,r,f,c]=await Promise.all([db.collection('loyaltyPointPrograms').doc(placeId).get(),db.collection('loyaltyPointRewards').where('placeId','==',placeId).limit(100).get(),db.collection('loyaltyFollows').where('placeId','==',placeId).where('active','==',true).get(),db.collection('loyaltyPointClaims').where('placeId','==',placeId).where('status','==','pending').limit(100).get()]);
  return {program:p.data()||null,rewards:r.docs.map(s=>s.data()),followers:{total:f.size,promotions:f.docs.filter(s=>s.data().promotions===true).length,birthdays:f.docs.filter(s=>s.data().birthdays===true).length},claims:c.docs.map(s=>({claimId:s.id,title:s.data().title,cost:s.data().cost,status:s.data().status}))};
 }
 return {configure,saveReward,redeem,settle,follow,wallet,overview};
}
module.exports={service,prepareAward,prepareReversal,key,configData,rewardData,LoyaltyError};
