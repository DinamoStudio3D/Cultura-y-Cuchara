'use strict';
const {authenticatedUser,firestore}=require('./_firebase-admin');
const {normalizeLoyalty,assertSafeEdit}=require('../functions/rewards-center-policy');
const {resolveRewardsActor}=require('../functions/rewards-center-access');
const fail=(status,message)=>Object.assign(new Error(message),{status});
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Allow','POST');
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
