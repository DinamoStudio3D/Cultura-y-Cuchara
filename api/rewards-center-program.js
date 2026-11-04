'use strict';
// Read-only endpoint for the rewards administration panel.
// Authentication and authorization happen on the server; no client-provided roles.
const {authenticatedUser,firestore}=require('./_firebase-admin');
const {assertPassportEditor}=require('../functions/rewards-center-access');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Allow','GET');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Método no permitido.'});
 try{
  const user=await authenticatedUser(req);
  const db=firestore();
  await assertPassportEditor({db,user});
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
};
