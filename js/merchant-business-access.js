(function(){
'use strict';
function normalizeEmail(value){return String(value||'').trim().toLowerCase();}
function unique(values){return [...new Set(values.filter(Boolean).map(String))];}
async function readNewAccess(db,user,roles){
  const email=normalizeEmail(user&&user.email);
  if(!email)return [];
  const snap=await db.collection('businessAccess').where('email','==',email).where('active','==',true).get();
  return snap.docs.map(d=>({id:d.id,...d.data(),source:'businessAccess'})).filter(x=>roles.includes(x.role));
}
async function readLegacy(db,user){
  if(!user||!user.uid)return null;
  const snap=await db.collection('missionRewardMerchants').doc(user.uid).get();
  if(!snap.exists||snap.data().active!==true)return null;
  return {id:snap.id,...snap.data(),source:'missionRewardMerchants'};
}
async function resolveOwnerAccess(db,user){
  let modern=[];
  try{modern=await readNewAccess(db,user,['owner']);}catch(error){console.warn('businessAccess todavía no disponible; usando compatibilidad temporal.',error);}
  if(modern.length){return {source:'businessAccess',role:'owner',placeIds:unique(modern.map(x=>x.placeId)),accesses:modern};}
  const legacy=await readLegacy(db,user);
  if(legacy&&Array.isArray(legacy.placeIds)&&legacy.placeIds.length){return {source:'missionRewardMerchants',role:'legacy',placeIds:unique(legacy.placeIds),legacy};}
  return null;
}
async function resolveOperationalAccess(db,user){
  let modern=[];
  try{modern=await readNewAccess(db,user,['owner','manager']);}catch(error){console.warn('businessAccess todavía no disponible; usando compatibilidad temporal.',error);}
  if(modern.length){return {source:'businessAccess',role:'operational',placeIds:unique(modern.map(x=>x.placeId)),accesses:modern};}
  const legacy=await readLegacy(db,user);
  if(legacy&&Array.isArray(legacy.placeIds)&&legacy.placeIds.length){return {source:'missionRewardMerchants',role:'legacy',placeIds:unique(legacy.placeIds),legacy};}
  return null;
}
window.VisitaLojaMerchantAccess=Object.freeze({resolveOwnerAccess,resolveOperationalAccess,normalizeEmail});
})();