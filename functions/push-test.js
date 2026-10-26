'use strict';
function createHandler({authenticate=req=>require('../api/_firebase-admin').authenticatedUser(req),db=()=>require('../api/_firebase-admin').firestore(),send=message=>require('firebase-admin/messaging').getMessaging(require('../api/_firebase-admin').app()).send(message),env=process.env,now=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método no permitido.'});}
  try{
   const user=await authenticate(req);const database=db();
   let admin=user.admin===true||user.role==='admin'||(user.email_verified===true&&user.email==='sukogames1996@gmail.com');
   if(!admin){const profile=await database.collection('adminUsers').doc(user.uid).get();admin=profile.exists&&profile.data().active===true&&profile.data().role==='admin';}
   if(!admin)return res.status(403).json({error:'Esta prueba es solo para administración.'});
   const vapidKey=env.FCM_WEB_VAPID_PUBLIC_KEY||'';
   if(!/^[A-Za-z0-9_-]{87}$/.test(vapidKey))return res.status(503).json({error:'Falta configurar la clave pública Web Push de Firebase en este despliegue.'});
   const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
   if(body.action==='config')return res.status(200).json({vapidKey});
   if(body.action!=='send'||typeof body.token!=='string'||body.token.length<20||body.token.length>4096||!/^[A-Za-z0-9_:.-]+$/.test(body.token))return res.status(400).json({error:'Dispositivo de prueba inválido.'});
   const time=now(),day=new Date(time).toISOString().slice(0,10),ref=database.collection('pushTestLimits').doc(user.uid);
   await database.runTransaction(async tx=>{const snap=await tx.get(ref),old=snap.exists?snap.data():{},count=old.day===day?old.count||0:0;if(time-(old.lastAt||0)<60000||count>=20)throw Object.assign(new Error('Espera un minuto entre pruebas. Máximo 20 al día.'),{status:429});tx.set(ref,{day,count:count+1,lastAt:time});});
   await wait(10000);
   await send({token:body.token,data:{title:'VisitaLoja · Prueba de notificación',body:'¡Funcionó! Este dispositivo puede recibir avisos de VisitaLoja.',url:'/push-test.html'},webpush:{headers:{TTL:'300',Urgency:'normal'}}});
   return res.status(200).json({accepted:true,message:'Firebase aceptó el envío. Comprueba la notificación en tu dispositivo.'});
  }catch(error){const status=error.status||(/messaging\//.test(error.code||'')?502:503);return res.status(status).json({error:status===401||status===429?error.message:status===502?'No se pudo enviar. Reactiva este dispositivo e inténtalo de nuevo.':'No se pudo preparar la prueba. Revisa la configuración de Firebase del despliegue.'});}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
