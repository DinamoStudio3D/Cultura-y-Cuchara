'use strict';
const {normalizeRewardDraft}=require('./rewards-draft-schema');
const {resolveRewardsActor,assertPassportEditor}=require('./rewards-center-access');
const COLLECTION='rewardsCenterDraftsPreview';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
function enabled(env){return env.VERCEL_ENV==='preview'&&env.REWARDS_DRAFT_WRITES==='approved-preview-v1'}
function id(value){if(typeof value!=='string'||!value||value.length>180||/[\/]/.test(value)||value==='.'||value==='..')fail(400,'Identificador inválido.');return value}
async function execute({db,user,input,now,env=process.env}){
 if(!enabled(env))fail(503,'Guardado remoto pendiente de autorización. Puedes conservar el borrador local.');
 if(!user?.uid)fail(401,'Inicia sesión.');
 if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Solicitud inválida.');
 const {action}=input;
 if(action==='queue'){
  await assertPassportEditor({db,user});
  const snap=await db.collection(COLLECTION).where('status','==','submitted').limit(100).get();
  return {drafts:snap.docs.map(d=>({id:d.id,...d.data()}))};
 }
 const placeId=id(input.placeId),authorUid=id(input.authorUid||user.uid);
 const actor=await resolveRewardsActor({db,user,placeId});
 if(authorUid!==user.uid&&(actor.role!=='admin'||['save','submit'].includes(action)))fail(403,'No puedes gestionar borradores de otro propietario.');
 const ref=db.collection(COLLECTION).doc(Buffer.from(JSON.stringify([placeId,authorUid])).toString('base64url'));
 if(action==='load'){const snap=await ref.get();return {draft:snap.exists?snap.data():null}}
 if(!['save','submit','approve','reject'].includes(action))fail(400,'Acción inválida.');
 if(!Number.isSafeInteger(input.revision)||input.revision<0)fail(400,'Versión inválida.');
 if(['approve','reject'].includes(action)&&actor.role!=='admin')fail(403,'Solo administración puede revisar.');
 const note=typeof input.note==='string'?input.note.trim():'';
 if(note.length>1000||(action==='reject'&&!note))fail(400,'Indica el motivo de devolución (máximo 1000 caracteres).');
 return db.runTransaction(async tx=>{
  // Recheck roles inside transaction so revocation conflicts with a concurrent save.
  const admin=await tx.get(db.collection('adminUsers').doc(user.uid));
  const owner=await tx.get(db.collection('businessAccess').doc(user.uid+'_'+placeId));
  const a=admin.exists?admin.data():{},o=owner.exists?owner.data():{};
  const isAdmin=(a.active===true&&a.role==='admin')||user.admin===true||user.role==='admin';
  if(!isAdmin&&!(o.active===true&&o.role==='owner'&&o.uid===user.uid&&o.placeId===placeId&&authorUid===user.uid))fail(403,'Acceso revocado.');
  if(['approve','reject'].includes(action)&&!isAdmin)fail(403,'Revisión no autorizada.');
  const snap=await tx.get(ref),old=snap.exists?snap.data():null;
  if((old?.revision||0)!==input.revision)fail(409,'El borrador cambió. Recarga antes de guardar.');
  let next;
  if(action==='save'){
   if(old&& !['draft','rejected','approved'].includes(old.status))fail(409,'El borrador está en revisión.');
   let data;try{data=normalizeRewardDraft(input.draft,placeId,authorUid,now)}catch(_){fail(400,'Revisa los campos del premio.');}
   next={...data,createdAt:old?.createdAt||now,status:'draft'};
  }else{
   if(!old)fail(404,'Borrador inexistente.');
   if(action==='submit'&&!['draft','rejected'].includes(old.status))fail(409,'El borrador no se puede enviar desde su estado actual.');
   if(action!=='submit'&&old.status!=='submitted')fail(409,'Este borrador ya no está pendiente de revisión.');
   next={...old,status:{submit:'submitted',approve:'approved',reject:'rejected'}[action],updatedAt:now,reviewNote:note};
   if(action!=='submit')next.reviewedBy=user.uid;
  }
  next.revision=input.revision+1;
  tx.set(ref,next);
  tx.set(ref.collection('history').doc(String(next.revision)),{...next,action,actorUid:user.uid});
  return {draft:next};
 });
}
module.exports={execute,enabled,COLLECTION};
