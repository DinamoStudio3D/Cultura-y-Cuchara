'use strict';
const {authenticatedUser,firestore}=require('./_firebase-admin');
const {normalizeLoyalty,assertSafeEdit}=require('../functions/rewards-center-policy');
const {resolveRewardsActor}=require('../functions/rewards-center-access');
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function readProgram(req,res){
 try{
  const user=await authenticatedUser(req);
  const db=firestore();
  await require('../functions/rewards-center-access').assertPassportEditor({db,user});
  const raw=req.query?.placeId;
  if(Array.isArray(raw)||typeof raw!=='string'||!/^[a-zA-Z0-9_-]{1,180}$/.test(raw))
   return res.status(400).json({error:'Identificador de parada inválido.'});
  const snap=await db.collection('loyaltyPrograms').doc(raw).get();
  if(!snap.exists)return res.status(404).json({error:'No existe un programa para esta parada.'});
  const p=snap.data()||{};
  // Allowlisted fields only: no user stamps, personal information or claim codes.
  return res.status(200).json({placeId:raw,program:{
   placeName:typeof p.placeName==='string'?p.placeName:null,
   active:p.active===true,
   targetVisits:Number.isInteger(p.targetVisits)?p.targetVisits:null,
   rewardTitle:typeof p.rewardTitle==='string'?p.rewardTitle:null,
   rewardDescription:typeof p.rewardDescription==='string'?p.rewardDescription:null,
   rewardType:typeof p.rewardType==='string'?p.rewardType:null,
   rewardValidityDays:Number.isInteger(p.rewardValidityDays)?p.rewardValidityDays:null,
   stock:Number.isInteger(p.stock)?p.stock:null
  }});
 }catch(error){
  const status=Number.isInteger(error?.status)?error.status:500;
  if(status>=500)console.error('rewards center read:',error?.message);
  return res.status(status).json({error:status<500?error.message:'No fue posible consultar el programa.'});
 }
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Allow','GET, POST');
 if(req.method==='GET')return readProgram(req,res);
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
 try{
  const user=await authenticatedUser(req);
  const input=req.body||{};
  const data=normalizeLoyalty(input);
  // Feature stays disabled even on previews until Firestore/rules/Worker compatibility is verified.
  if(process.env.REWARDS_CENTER_WRITE_ENABLED!=='true')return res.status(503).json({error:'El editor de recompensas todavía no está habilitado.'});
  const db=firestore();
  const actor=await resolveRewardsActor({db,user,placeId:data.placeId});
  // Merchant/employee roles need a separately verified owner-only write grant.
  if(actor.role!=='admin')throw fail(403,'La edición por propietarios todavía no está habilitada.');
  const placeRef=db.collection('locales').doc(data.placeId);
  const programRef=db.collection('loyaltyPrograms').doc(data.placeId);
  // Refuse all edits to existing cards until progress and issuance checks are integrated.
  const result=await db.runTransaction(async tx=>{
   const [place,existing]=await Promise.all([tx.get(placeRef),tx.get(programRef)]);
   if(!place.exists)throw fail(404,'La parada no existe.');
   if(existing.exists)throw fail(409,'Esta parada ya tiene un programa. La edición requiere protección del historial.');
   // Creation is also blocked pending explicit enablement of new-program writes.
   if(process.env.REWARDS_CENTER_CREATE_ENABLED!=='true')throw fail(503,'La creación de programas aún no está habilitada.');
   assertSafeEdit(null,data);
   tx.create(programRef,{...data,placeName:place.data().title||data.placeId,updatedBy:user.email||user.uid,updatedAt:require('firebase-admin/firestore').FieldValue.serverTimestamp()});
   return {placeId:data.placeId,created:true};
  });
  return res.status(201).json(result);
 }catch(error){
  const status=Number.isInteger(error?.status)?error.status:(/Revisa|inválid|permitido|autorización/i.test(error?.message||'')?400:503);
  if(status>=500)console.error('rewards center save:',error?.message);
  return res.status(status).json({error:status<500?error.message:'No se pudo guardar la configuración.'});
 }
};
