'use strict';
const {key,LoyaltyError,manager}=require('./loyalty-points-service');
const fail=(code,message)=>{throw new LoyaltyError(code,message)};
function id(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))fail('invalid-argument','Identificador inválido.');return value;}
function integer(value,min,max){if(!Number.isSafeInteger(value)||value<min||value>max)fail('invalid-argument','Cantidad inválida.');return value;}
function text(value,max,optional=false){if(typeof value!=='string'||(!optional&&!value.trim())||value.trim().length>max)fail('invalid-argument','Texto inválido.');return value.trim();}
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))fail('invalid-argument','Define inicio y fin en hora de Ecuador.');const stamp=Date.parse(value+':00-05:00');if(!Number.isFinite(stamp)||new Date(stamp-18000000).toISOString().slice(0,16)!==value)fail('invalid-argument','Fecha inválida.');return stamp;}
function content(data){const startsAt=date(data.startsAt),endsAt=date(data.endsAt);if(startsAt>=endsAt||endsAt-startsAt>30*86400000)fail('invalid-argument','La ventana debe durar entre un minuto y 30 días.');return {title:text(data.title,120),message:text(data.message,500),conditions:text(data.conditions||'',400,true),startsAt,endsAt};}
function service({db,clock=()=>Date.now(),timestamp=value=>value,documentId='__name__'}){
 const notificationRef=(uid,nid)=>db.collection('loyaltyNotificationUsers').doc(uid).collection('inbox').doc(nid);
 function actor(auth){if(!auth?.uid)fail('unauthenticated','Inicia sesión.');id(auth.uid);return auth;}
 const programRef=placeId=>db.collection('loyaltyNotificationPrograms').doc(placeId);
 const campaignRef=(placeId,campaignId)=>db.collection('loyaltyPromotionCampaigns').doc(key(placeId,campaignId));
 async function context(tx,auth,placeId,{enabled=true,ownerPermission=false}={}){
  actor(auth);id(placeId);const isAdmin=await manager(tx,db,auth,placeId);
  const [gate,program,place]=await Promise.all([tx.get(db.collection('settings').doc('loyaltyNotificationsV88')),tx.get(programRef(placeId)),tx.get(db.collection('locales').doc(placeId))]);
  if(!place.exists)fail('not-found','La parada no existe.');
  if(enabled&&gate.data()?.enabled!==true)fail('failed-precondition','Los avisos internos todavía no están habilitados.');
  if(ownerPermission&&!isAdmin&&program.data()?.ownerCanPublish!==true)fail('permission-denied','El administrador debe autorizar la publicación.');
  return {isAdmin,program:program.data()||{},place:place.data(),gate:gate.data()||{}};
 }
 async function configure(auth,data){const placeId=id(data.placeId);return db.runTransaction(async tx=>{
  const ctx=await context(tx,auth,placeId);if(!ctx.isAdmin)fail('permission-denied','Configuración exclusiva del administrador.');
  if(typeof data.enabled!=='boolean'||typeof data.ownerCanPublish!=='boolean')fail('invalid-argument','Controles inválidos.');
  const value={placeId,enabled:data.enabled,ownerCanPublish:data.ownerCanPublish,maxDailyDeliveries:integer(data.maxDailyDeliveries,1,500),batchSize:integer(data.batchSize??Math.min(25,data.maxDailyDeliveries),1,Math.min(50,data.maxDailyDeliveries)),updatedBy:auth.uid,updatedAt:timestamp(clock())};
  tx.set(programRef(placeId),value);return value;
 });}
 async function save(auth,data){const placeId=id(data.placeId),campaignId=id(data.campaignId),value=content(data),version=integer(data.expectedVersion??0,0,1000000);return db.runTransaction(async tx=>{
  await context(tx,auth,placeId);const ref=campaignRef(placeId,campaignId),old=await tx.get(ref);
  if(old.exists&&old.data().status!=='draft')fail('failed-precondition','Una promoción publicada no puede editarse. Crea otra promoción.');
  if((old.data()?.version??0)!==version)fail('aborted','El borrador cambió. Vuelve a consultarlo.');
  const campaign={placeId,campaignId,...value,status:'draft',version:version+1,deliveryCount:0,createdBy:old.data()?.createdBy??auth.uid,createdAt:old.data()?.createdAt??timestamp(clock()),updatedBy:auth.uid,updatedAt:timestamp(clock())};
  tx.set(ref,campaign);return campaign;
 });}
 async function publish(auth,data){const placeId=id(data.placeId),campaignId=id(data.campaignId),expectedVersion=integer(data.expectedVersion,1,1000001);return db.runTransaction(async tx=>{
  const ctx=await context(tx,auth,placeId,{ownerPermission:true}),ref=campaignRef(placeId,campaignId),snapshot=await tx.get(ref),campaign=snapshot.data();
  if(!snapshot.exists)fail('not-found','Promoción no encontrada.');if(campaign.version!==expectedVersion)fail('aborted','El borrador cambió. Vuelve a consultarlo.');
  if(ctx.program.enabled!==true||ctx.place.publicationStatus&&ctx.place.publicationStatus!=='published')fail('failed-precondition','Avisos desactivados para esta parada.');
  if(campaign.status==='published')return {status:'published',version:campaign.version};
  if(campaign.status!=='draft'||clock()>=campaign.endsAt)fail('failed-precondition','La promoción no puede publicarse.');
  tx.update(ref,{status:'published',publishedBy:auth.uid,publishedAt:timestamp(clock())});return {status:'published',version:campaign.version};
 });}
 async function pause(auth,data){const placeId=id(data.placeId),campaignId=id(data.campaignId);return db.runTransaction(async tx=>{
  await context(tx,auth,placeId,{enabled:false});const ref=campaignRef(placeId,campaignId),snapshot=await tx.get(ref);if(!snapshot.exists)fail('not-found','Promoción no encontrada.');
  if(snapshot.data().status==='paused')return {status:'paused'};if(snapshot.data().status!=='published')fail('failed-precondition','Solo puedes pausar una promoción publicada.');
  tx.update(ref,{status:'paused',pausedBy:auth.uid,pausedAt:timestamp(clock())});return {status:'paused'};
 });}
 async function dispatch(auth,data){const placeId=id(data.placeId),campaignId=id(data.campaignId),cursor=data.cursor==null?null:id(data.cursor);return db.runTransaction(async tx=>{
  const ctx=await context(tx,auth,placeId,{ownerPermission:true}),ref=campaignRef(placeId,campaignId);
  const [campaignDoc,followGate]=await Promise.all([tx.get(ref),tx.get(db.collection('settings').doc('loyaltyV83'))]);const campaign=campaignDoc.data(),at=clock();
  if(!campaignDoc.exists)fail('not-found','Promoción no encontrada.');
  if(ctx.program.enabled!==true||followGate.data()?.enabled!==true||campaign.status!=='published'||at<campaign.startsAt||at>=campaign.endsAt||ctx.place.publicationStatus&&ctx.place.publicationStatus!=='published')fail('failed-precondition','La promoción no está disponible para entregar avisos.');
  const size=integer(ctx.program.batchSize,1,50),daily=integer(ctx.program.maxDailyDeliveries,1,500);
  let query=db.collection('loyaltyFollows').where('placeId','==',placeId).where('active','==',true).where('promotions','==',true).where('consentVersion','==',1).orderBy(documentId);
  if(cursor)query=query.startAfter(cursor);
  const followers=await tx.get(query.limit(size+1)),batch=followers.docs.slice(0,size);
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
  const quotaRef=db.collection('loyaltyNotificationQuotas').doc(key(placeId,day)),quota=await tx.get(quotaRef),used=integer(quota.data()?.delivered??0,0,1000000);
  const plans=batch.map(snapshot=>{const follower=snapshot.data(),uid=id(follower.userId);if(follower.placeId!==placeId||follower.active!==true||follower.promotions!==true||follower.consentVersion!==1||snapshot.id!==key(uid,placeId))fail('failed-precondition','Seguidor inconsistente.');return {uid,ref:notificationRef(uid,key('promotion',ref.id,uid))};});
  const existing=await Promise.all(plans.map(plan=>tx.get(plan.ref))),pending=plans.filter((_,index)=>!existing[index].exists);
  if(used+pending.length>daily)fail('resource-exhausted','Límite diario de avisos alcanzado. Reintenta otro día.');
  const createdAt=timestamp(at),placeName=text(String(ctx.place.title||placeId),160);
  for(const plan of pending)tx.create(plan.ref,{notificationId:plan.ref.id,userId:plan.uid,placeId,placeName,campaignId,type:'promotion',title:campaign.title,message:campaign.message,conditions:campaign.conditions,url:'/fidelidad.html?place='+encodeURIComponent(placeId),createdAt,readAt:null,push:false});
  const count=integer(campaign.deliveryCount??0,0,1000000000)+pending.length;
  if(pending.length){tx.set(quotaRef,{placeId,day,delivered:used+pending.length,updatedAt:createdAt});tx.update(ref,{deliveryCount:count});}
  return {created:pending.length,alreadyDelivered:batch.length-pending.length,totalDelivered:count,nextCursor:followers.docs.length>size?batch[batch.length-1].id:null};
 });}
 async function overview(auth,data){const placeId=id(data.placeId);await db.runTransaction(tx=>context(tx,auth,placeId,{enabled:false}));const [gate,program,campaigns]=await Promise.all([db.collection('settings').doc('loyaltyNotificationsV88').get(),programRef(placeId).get(),db.collection('loyaltyPromotionCampaigns').where('placeId','==',placeId).limit(100).get()]);return {runtime:{enabled:gate.data()?.enabled===true},program:program.data()||null,campaigns:campaigns.docs.map(snapshot=>snapshot.data())};}
 async function inbox(auth){actor(auth);const snapshot=await db.collection('loyaltyNotificationUsers').doc(auth.uid).collection('inbox').orderBy('createdAt','desc').limit(50).get();return {notifications:snapshot.docs.map(doc=>({...doc.data(),notificationId:doc.id})),limit:50};}
 async function markRead(auth,data){actor(auth);const notificationId=id(data.notificationId);return db.runTransaction(async tx=>{const ref=notificationRef(auth.uid,notificationId),snapshot=await tx.get(ref);if(!snapshot.exists)fail('not-found','Aviso no encontrado.');if(snapshot.data().userId!==auth.uid)fail('permission-denied','Aviso no autorizado.');if(snapshot.data().readAt!=null)return {read:true};tx.update(ref,{readAt:timestamp(clock())});return {read:true};});}
 return {configure,save,publish,pause,dispatch,overview,inbox,markRead};
}
module.exports={service,content};
