'use strict';
const {randomBytes}=require('node:crypto');
const {Timestamp,FieldValue}=require('firebase-admin/firestore');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const FOOD=new Set(['hueca','cafe','urbana','heladeria','panaderia','bar']);
function completionId(uid,campaignId,mode){return `${uid}_${campaignId}_${mode}`;}
function rewardFor(config,mode,optionId){
 const reward=mode==='turista'?config.tourist:config.local;
 if(!reward||reward.active===false)throw fail(412,'Las recompensas de esta modalidad no están disponibles.');
 if(reward.choices){
  const choice=Object.prototype.hasOwnProperty.call(reward.choices,optionId)?reward.choices[optionId]:null;
  if(!choice||choice.active!==true)throw fail(412,'Selecciona una recompensa disponible.');
  return {optionId,snapshot:{...choice}};
 }
 return {optionId:'primary',snapshot:{active:true,title:reward.title||'Recompensa del pasaporte',description:reward.description||'',merchantUid:reward.merchantUid||''}};
}
function eligibleStops(stamps,visits,places,{uid,campaignId,mode}){
 const unique=new Map();
 for(const stamp of stamps){
  const visit=visits.get(stamp.requestId),place=places.get(stamp.placeId);
  if(stamp.userId!==uid||stamp.campaignId!==campaignId||!visit||visit.status!=='confirmed'||visit.userId!==uid||visit.placeId!==stamp.placeId||!visit.confirmedAt||!stamp.confirmedAt||!place)continue;
  if(!unique.has(stamp.placeId))unique.set(stamp.placeId,{placeId:stamp.placeId,requestId:stamp.requestId,category:place.category});
 }
 const food=[...unique.values()].filter(x=>FOOD.has(x.category));
 if(mode==='lojano')return food.length>=6?food.slice(0,6):null;
 const hotel=[...unique.values()].find(x=>x.category==='hotel');
 return hotel&&food.length>=5?[hotel,...food.slice(0,5)]:null;
}
function publicClaim(data,alreadyRegistered){return {claimCode:data.claimCode,status:data.status,rewardSnapshot:data.rewardSnapshot||null,optionId:data.optionId||'',alreadyRegistered};}
async function claimPassport({db,user,input,now=Timestamp.now()}){
 const mode=input?.mode,campaignId=input?.campaignId,optionId=typeof input?.optionId==='string'?input.optionId:'';
 if(!['turista','lojano'].includes(mode)||typeof campaignId!=='string'||!/^[a-zA-Z0-9_-]{1,60}$/.test(campaignId)||optionId.length>80)throw fail(400,'Revisa la campaña y la modalidad del pasaporte.');
 const uid=user.uid,ref=db.collection('passportCompletions').doc(completionId(uid,campaignId,mode));
 // One stable code per request even when Firestore retries the transaction.
 const claimCode='PAS-'+randomBytes(6).toString('hex').toUpperCase(),codeRef=db.collection('passportRewardClaimCodes').doc(claimCode);
 return db.runTransaction(async tx=>{
  const existing=await tx.get(ref);if(existing.exists){const data=existing.data();if(data.userId!==uid)throw fail(403,'El registro no pertenece a esta cuenta.');return publicClaim(data,true);}
  const [configSnap,profileSnap,codeSnap]=await Promise.all([tx.get(db.collection('siteContent').doc('passport')),tx.get(db.collection('userProfiles').doc(uid)),tx.get(codeRef)]);
  if(!profileSnap.exists||profileSnap.data().profileComplete!==true)throw fail(412,'Completa tu perfil antes de reclamar.');
  if(!configSnap.exists)throw fail(412,'No hay una campaña de pasaporte disponible.');
  const config=configSnap.data(),time=now.toMillis();
  if(config.campaignId!==campaignId||config.active===false)throw fail(412,'Esta campaña ya no está disponible.');
  for(const [key,compare]of [['startAt',date=>time<date],['endAt',date=>time>=date]])if(config[key]){const date=Date.parse(config[key]);if(!Number.isFinite(date)||compare(date))throw fail(412,'La campaña no está dentro de su periodo de canje.');}
  const selected=rewardFor(config,mode,optionId);
  if(selected.snapshot.merchantUid){const merchant=await tx.get(db.collection('missionRewardMerchants').doc(selected.snapshot.merchantUid));if(!merchant.exists||merchant.data().active!==true)throw fail(412,'El negocio de entrega no está disponible.');}
  if(codeSnap.exists)throw fail(409,'No se pudo generar el código. Inténtalo nuevamente.');
  const stampDocs=await tx.get(db.collection('securePassportStamps').where('userId','==',uid).limit(1001));
  if(stampDocs.size>1000)throw fail(412,'Tu historial requiere revisión antes de generar este premio.');
  const stamps=stampDocs.docs.map(doc=>doc.data()).filter(s=>s.campaignId===campaignId&&typeof s.placeId==='string'&&s.placeId&&!s.placeId.includes('/')&&typeof s.requestId==='string'&&s.requestId&&!s.requestId.includes('/'));
  const visitIds=[...new Set(stamps.map(s=>s.requestId))],placeIds=[...new Set(stamps.map(s=>s.placeId))];
  const visitDocs=await Promise.all(visitIds.map(id=>tx.get(db.collection('loyaltyVisits').doc(id)))),placeDocs=await Promise.all(placeIds.map(id=>tx.get(db.collection('locales').doc(id))));
  const visits=new Map(visitDocs.filter(doc=>doc.exists).map(doc=>[doc.id,doc.data()])),places=new Map(placeDocs.filter(doc=>doc.exists).map(doc=>[doc.id,doc.data()]));
  const proof=eligibleStops(stamps,visits,places,{uid,campaignId,mode});
  if(!proof)throw fail(412,mode==='turista'?'Necesitas visitas confirmadas en un hotel y cinco paradas gastronómicas distintas.':'Necesitas visitas confirmadas en seis paradas gastronómicas distintas.');
  const claim={campaignId,mode,userId:uid,stampsCount:6,claimCode,status:'pending',completedAt:now,optionId:selected.optionId,rewardSnapshot:selected.snapshot,merchantUid:selected.snapshot.merchantUid||'',validationVersion:1,validatedStops:proof};
  for(const stop of proof)tx.update(db.collection('loyaltyVisits').doc(stop.requestId),{passportClaimIds:FieldValue.arrayUnion(ref.id)});
  tx.create(ref,claim);tx.create(codeRef,{completionId:ref.id,campaignId,mode,userId:uid,createdAt:now,optionId:selected.optionId,merchantUid:claim.merchantUid});
  return publicClaim(claim,false);
 });
}
module.exports={claimPassport,eligibleStops,rewardFor,completionId};
