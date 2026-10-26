'use strict';
const {createHash,randomUUID}=require('node:crypto');
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const tokenValue=value=>{if(typeof value!=='string'||value.length<20||value.length>4096||!/^[A-Za-z0-9_:.-]+$/.test(value))fail(400,'Dispositivo inválido. Activa las notificaciones nuevamente.');return value;};
function content(input){
 const title=String(input.title||'').trim(),message=String(input.message||'').trim(),url=String(input.url||'/').trim();
 if(!title||title.length>80||!message||message.length>240)fail(400,'Escribe un título de hasta 80 caracteres y un mensaje de hasta 240.');
 if(!url.startsWith('/')||url.startsWith('//')||/[\\\s\x00-\x1f]/.test(url)||url.length>500)fail(400,'El destino debe ser una página de VisitaLoja.');
 const parsed=new URL(url,'https://www.visitaloja.com');
 const paths=['/','/cantones.html','/fidelidad.html','/agenda.html','/loja-en-el-tiempo.html','/mesa-turistica.html','/aliados.html','/que-hacer-en-loja','/hoteles-en-loja','/restaurantes-en-loja','/cafeterias-en-loja','/huecas-en-loja','/panaderias-en-loja','/heladerias-en-loja','/bares-en-loja','/entretenimiento-en-loja','/artesanias-en-loja'];
 if(parsed.origin!=='https://www.visitaloja.com'||!paths.includes(parsed.pathname)&&!/^\/parada\/[a-zA-Z0-9_-]+\/?$/.test(parsed.pathname))fail(400,'Selecciona una página pública de VisitaLoja como destino.');
 return {title,message,url:parsed.pathname+parsed.search+parsed.hash};
}
function service({db,send,clock=Date.now,uuid=randomUUID,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 function scope(origin){return db.collection('pushScopes').doc(hash(origin));}
 async function admin(user){if(user.admin===true||user.role==='admin'||user.email_verified===true&&user.email==='sukogames1996@gmail.com')return;const snap=await db.collection('adminUsers').doc(user.uid).get();if(!snap.exists||snap.data().active!==true||snap.data().role!=='admin')fail(403,'Solo administración puede gestionar avisos.');}
 async function quota(root,user,kind,max,cooldown=0){const ref=root.collection('limits').doc(hash(user.uid+kind));await db.runTransaction(async tx=>{const snap=await tx.get(ref),old=snap.exists?snap.data():{},now=clock(),day=new Date(now).toISOString().slice(0,10),count=old.day===day?old.count:0;if((count||0)>=max||cooldown&&now-(old.lastAt||0)<cooldown)fail(429,'Se alcanzó el límite de pruebas o envíos. Espera antes de volver a intentarlo.');tx.set(ref,{day,count:(count||0)+1,lastAt:now});});}
 const eligible=(device,userId)=>device?.active===true&&device.consentVersion===1&&typeof device.token==='string'&&(!userId||device.userId===userId);
 const project=doc=>{const d=doc.data();return {id:doc.id,title:d.title,message:d.message,url:d.url,createdAt:d.createdAt,createdBy:d.createdBy,status:d.status,total:d.total,testedAt:d.testedAt||null};};
 async function detail(root,id){const ref=root.collection('campaigns').doc(id),snap=await ref.get();if(!snap.exists)fail(404,'Aviso no encontrado.');const results=await ref.collection('deliveries').get(),counts={pending:0,accepted:0,failed:0,skipped:0,uncertain:0};for(const doc of results.docs){const state=doc.data().status;counts[state==='sending'?'uncertain':state]=(counts[state==='sending'?'uncertain':state]||0)+1;}return {...project(snap),counts};}
 async function execute(user,origin,input){
  if(!user?.uid)fail(401,'Inicia sesión para administrar tus notificaciones.');
  const root=scope(origin),action=input.action;
  if(action==='subscribe'||action==='unsubscribe'||action==='device'){
   const token=action==='subscribe'||input.token?tokenValue(input.token):null;
   const id=token?hash(token):String(input.deviceId||'');if(!/^[a-f0-9]{64}$/.test(id))fail(400,'Dispositivo inválido.');
   const ref=root.collection('devices').doc(id);
   if(action==='device'){const snap=await ref.get();return {active:snap.exists&&eligible(snap.data(),user.uid)};}
   if(action==='subscribe'&&input.consent!==true)fail(400,'Debes aceptar recibir novedades y promociones de VisitaLoja.');
   if(action==='subscribe')await quota(root,user,'subscribe',60);
   await db.runTransaction(async tx=>{const snap=await tx.get(ref),old=snap.exists?snap.data():null;if(old&&old.userId!==user.uid)fail(409,'Este navegador está asociado a otra cuenta. Desactívalo con esa cuenta primero.');if(action==='unsubscribe'){if(old)tx.set(ref,{...old,active:false,token:null,updatedAt:clock()});return;}tx.set(ref,{userId:user.uid,token,active:true,consentVersion:1,consentId:eligible(old,user.uid)?old.consentId:uuid(),createdAt:old?.createdAt||clock(),updatedAt:clock()});});return {active:action==='subscribe',deviceId:id};
  }
  await admin(user);
  if(action==='overview'){
   const [devices,campaigns]=await Promise.all([root.collection('devices').where('active','==',true).limit(401).get(),root.collection('campaigns').orderBy('createdAt','desc').limit(30).get()]);
   return {devices:devices.docs.filter(doc=>eligible(doc.data())).length,overLimit:devices.size>400,maxDevices:400,campaigns:campaigns.docs.map(project)};
  }
  const id=String(input.campaignId||'');if(!/^[a-zA-Z0-9_-]{10,80}$/.test(id))fail(400,'Identificador de aviso inválido.');
  const ref=root.collection('campaigns').doc(id);
  if(action==='prepare'){
   const payload=content(input),digest=hash(JSON.stringify(payload)),existing=await ref.get();
   if(existing.exists){if(existing.data().digest!==digest)fail(409,'Este aviso ya está guardado. Prepara otro para cambiar su contenido.');return detail(root,id);}
   const devices=await root.collection('devices').where('active','==',true).limit(401).get();if(devices.size>400)fail(412,'Esta primera versión admite hasta 400 dispositivos por aviso. No se ha enviado nada.');
   const audience=devices.docs.filter(doc=>eligible(doc.data()));if(!audience.length)fail(412,'Todavía no hay dispositivos suscritos en esta versión de la web.');
   const now=clock(),day=new Date(now).toISOString().slice(0,10),limitRef=root.collection('limits').doc(hash(user.uid+'prepare'));
   await db.runTransaction(async tx=>{const [previous,limit]=await Promise.all([tx.get(ref),tx.get(limitRef)]);if(previous.exists){if(previous.data().digest!==digest)fail(409,'El aviso ya existe con otro contenido.');return;}const old=limit.exists?limit.data():{},count=old.day===day?old.count||0:0;if(count>=3)fail(429,'Puedes preparar hasta tres avisos por día.');tx.set(limitRef,{day,count:count+1});tx.create(ref,{...payload,digest,createdAt:now,createdBy:user.uid,status:'prepared',total:audience.length,testedAt:null});for(const doc of audience)tx.create(ref.collection('deliveries').doc(doc.id),{deviceId:doc.id,userId:doc.data().userId,consentId:doc.data().consentId,status:'pending'});});return detail(root,id);
  }
  if(action==='detail')return detail(root,id);
  const snapshot=await ref.get();if(!snapshot.exists)fail(404,'Aviso no encontrado.');const campaign=snapshot.data();
  if(action==='test'){
   if(campaign.status!=='prepared')fail(412,'Solo puedes probar un aviso que aún no se ha enviado.');
   const token=tokenValue(input.token),deviceRef=root.collection('devices').doc(hash(token)),device=await deviceRef.get();if(!device.exists||!eligible(device.data(),user.uid))fail(412,'Activa las notificaciones de este dispositivo antes de probar.');
   await quota(root,user,'test',20,60000);await wait(10000);
   const current=await deviceRef.get();if(!current.exists||!eligible(current.data(),user.uid))fail(412,'El dispositivo fue desactivado.');
   await send({token,data:{...{title:campaign.title,body:campaign.message,url:campaign.url},tag:'prueba-'+id},webpush:{headers:{TTL:'300'}}});
   await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.data()?.status==='prepared')tx.update(ref,{testedAt:clock()});});return {accepted:true,message:'Firebase aceptó la prueba. Confirma que llegó antes del envío general.'};
  }
  if(action!=='dispatch')fail(400,'Acción no disponible.');
  if(input.confirmation!=='ENVIAR '+campaign.total||input.testReceived!==true)fail(400,'Confirma la cantidad de dispositivos y que recibiste la prueba.');
  if(!campaign.testedAt||clock()-campaign.testedAt>86400000)fail(412,'Primero envíate una prueba de este aviso; es válida por 24 horas.');
  const lease=uuid();await db.runTransaction(async tx=>{const snap=await tx.get(ref),c=snap.data();if(c.status==='completed')return;if(c.lockUntil>clock())fail(409,'Hay un lote en proceso. Espera y actualiza el historial.');tx.update(ref,{status:'sending',lockUntil:clock()+120000,lease});});
  if(campaign.status==='completed')return detail(root,id);
  const pending=await ref.collection('deliveries').where('status','==','pending').limit(25).get();
  await Promise.all(pending.docs.map(async recipient=>{
   const deliveryRef=ref.collection('deliveries').doc(recipient.id),deviceRef=root.collection('devices').doc(recipient.id);
   const token=await db.runTransaction(async tx=>{const [delivery,device,camp]=await Promise.all([tx.get(deliveryRef),tx.get(deviceRef),tx.get(ref)]);const d=delivery.data(),s=device.exists?device.data():null;if(camp.data().lease!==lease||d.status!=='pending')return null;if(!eligible(s,d.userId)||s.consentId!==d.consentId){tx.update(deliveryRef,{status:'skipped',updatedAt:clock()});return null;}tx.update(deliveryRef,{status:'sending',updatedAt:clock()});return s.token;});
   if(!token)return;
   // Once claimed, an ambiguous/crashed attempt is never resent automatically.
   let status='uncertain',invalid=false;
   try{await send({token,data:{title:campaign.title,body:campaign.message,url:campaign.url,tag:'aviso-'+id},webpush:{headers:{TTL:'3600'}}});status='accepted';}
   catch(error){invalid=['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code);status=invalid||error.code==='messaging/invalid-argument'?'failed':'uncertain';}
   await db.runTransaction(async tx=>{const device=invalid?await tx.get(deviceRef):null;tx.update(deliveryRef,{status,updatedAt:clock()});if(invalid&&device.exists&&device.data().token===token)tx.update(deviceRef,{active:false,token:null,updatedAt:clock()});});
  }));
  const remaining=await ref.collection('deliveries').where('status','==','pending').limit(1).get();await db.runTransaction(async tx=>{const c=await tx.get(ref);if(c.data().lease===lease)tx.update(ref,{status:remaining.size?'sending':'completed',lockUntil:0,updatedAt:clock()});});
  return detail(root,id);
 }
 return {execute};
}
function createHandler({authenticate=req=>require('../api/_firebase-admin').authenticatedUser(req),db=()=>require('../api/_firebase-admin').firestore(),send=message=>require('firebase-admin/messaging').getMessaging(require('../api/_firebase-admin').app()).send(message),env=process.env,clock=Date.now,wait}={}){
 return async(req,res)=>{res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});try{
  const host=String(req.headers.host||'').toLowerCase();if(!/^(www\.)?visitaloja\.com$/.test(host)&&!/^visitaloja-[a-z0-9-]+\.vercel\.app$/.test(host))fail(400,'Dominio no válido para notificaciones.');const origin='https://'+host;
  if(req.headers.origin&&req.headers.origin!==origin)fail(403,'Origen de petición inválido.');
  const user=await authenticate(req),input=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(input.action==='config'){if(!/^[A-Za-z0-9_-]{87}$/.test(env.FCM_WEB_VAPID_PUBLIC_KEY||''))fail(503,'Las notificaciones aún no están configuradas en esta versión.');return res.status(200).json({vapidKey:env.FCM_WEB_VAPID_PUBLIC_KEY});}
  const result=await service({db:db(),send,clock,wait}).execute(user,origin,input);return res.status(200).json(result);
 }catch(error){if(!error.status)console.error('push-operation-failed',{code:error.code||'internal'});return res.status(error.status||503).json({error:error.status?error.message:'No se pudo completar la operación. Actualiza el historial antes de repetir un envío.'});}};
}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.service=service;module.exports.content=content;
