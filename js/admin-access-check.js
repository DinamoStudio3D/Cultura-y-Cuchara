(function(root){
 'use strict';
 async function resolve(user,{legacyEmail,adminUsers}){
  if(!user)return false;
  if(String(user.email||'').toLowerCase()===String(legacyEmail).toLowerCase())return true;
  try{
   const token=await user.getIdTokenResult(true),claims=token.claims||{};
   if(claims.admin===true||['admin','owner'].includes(claims.role))return true;
   const profile=await adminUsers.doc(user.uid).get(),data=profile.exists?profile.data():null;
   return !!data&&data.active===true&&['admin','owner'].includes(data.role);
  }catch(_){return false;}
 }
 const api={resolve};if(typeof module==='object'&&module.exports)module.exports=api;root.VisitaLojaAdminAccess=api;
})(typeof window==='object'?window:globalThis);
