'use strict';
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
 const {enabled,execute}=require('./rewards-draft-store');
 if(!enabled(process.env))return res.status(503).json({error:'Guardado remoto pendiente de autorización. Conserva tu borrador local.',code:'REWARDS_DISABLED'});
 if(Buffer.byteLength(JSON.stringify(req.body||{}))>16384)return res.status(413).json({error:'Solicitud demasiado grande.'});
 try{
  const {authenticatedUser}=require('../api/_firebase-admin');
  const user=await authenticatedUser(req);
  const {getApps,initializeApp,cert}=require('firebase-admin/app');
  const {getFirestore,Timestamp}=require('firebase-admin/firestore');
  const projectId=process.env.REWARDS_PREVIEW_FIREBASE_PROJECT;
  const account=JSON.parse(process.env.REWARDS_PREVIEW_FIREBASE_ACCOUNT||'null');
  if(!projectId||projectId==='cultura-y-cuchara'||account?.project_id!==projectId){
    return res.status(503).json({error:'El proyecto Firebase aislado todavía no está configurado.'});
  }
  const name='rewards-preview-storage';
  const app=getApps().find(candidate=>candidate.name===name)||initializeApp({projectId,credential:cert(account)},name);
  return res.status(200).json(await execute({db:getFirestore(app),user,input:req.body,now:Timestamp.now()}));
 }catch(error){return res.status(error.status||503).json({error:error.status?error.message:'No se pudo procesar el borrador.'})}
};
