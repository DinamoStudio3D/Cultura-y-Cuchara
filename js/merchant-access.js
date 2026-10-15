(function(root){
 'use strict';
 async function create(input,deps){
  let uid=null;
  const actor=deps.primaryAuth.currentUser;
  try{
   if(!actor||!await deps.authorize(actor)||deps.primaryAuth.currentUser?.uid!==actor.uid)throw {code:'access/unauthorized'};
   const businessName=String(input.businessName||'').trim(),email=String(input.email||'').trim().toLowerCase(),placeIds=[...new Set(input.placeIds||[])];
   if(!businessName||businessName.length>120||!/^\S+@\S+\.\S+$/.test(email)||typeof input.password!=='string'||input.password.length<8||!placeIds.length||placeIds.some(id=>!deps.knownPlaceIds.includes(id)))throw {code:'input/invalid'};
   await deps.secondaryAuth.setPersistence(deps.persistence);
   const credential=await deps.secondaryAuth.createUserWithEmailAndPassword(email,input.password);uid=credential.user.uid;
   if(deps.primaryAuth.currentUser?.uid!==actor.uid||!await deps.authorize(deps.primaryAuth.currentUser))throw {code:'access/session-changed'};
   // A transaction refuses to overwrite a record even for an unexpected UID collision.
   await deps.merchants.firestore.runTransaction(async transaction=>{
    const ref=deps.merchants.doc(uid),existing=await transaction.get(ref);
    if(existing.exists)throw {code:'access/already-assigned'};
    transaction.set(ref,{businessName,email,placeIds,active:true,createdBy:actor.uid,updatedBy:actor.uid,createdAt:deps.timestamp(),updatedAt:deps.timestamp()});
   });
   return {status:'complete',uid};
  }catch(error){return {status:uid?'partial':'failed',uid,code:String(error?.code||'operation/failed')};}
  finally{await deps.secondaryAuth.signOut().catch(()=>{});}
 }
 function bindLogin(doc,auth,provider){
  const form=doc.getElementById('merchantLoginForm'),button=doc.getElementById('merchantLoginSubmit'),google=doc.getElementById('google'),notice=doc.getElementById('merchantLoginMessage'),password=doc.getElementById('merchantLoginPassword');
  const recovery=doc.getElementById('merchantResetPassword');
  let busy=false;
  function lock(value){button.disabled=google.disabled=value;if(recovery)recovery.disabled=value;}
  async function signIn(action){if(busy)return;busy=true;lock(true);notice.textContent='Ingresando…';try{await action();notice.textContent='';}catch(error){notice.textContent=root.VisitaLojaAccountAccess?root.VisitaLojaAccountAccess.errorMessage(error):'No se pudo ingresar. Revisa tus credenciales, conexión y método de acceso autorizado.';}finally{password.value='';busy=false;lock(false);}}
  form.addEventListener('submit',event=>{event.preventDefault();const value=password.value;password.value='';return signIn(()=>auth.signInWithEmailAndPassword(doc.getElementById('merchantLoginEmail').value.trim(),value));});
  google.onclick=()=>signIn(()=>root.VisitaLojaAccountAccess?root.VisitaLojaAccountAccess.google(auth,provider):auth.signInWithPopup(provider()));
  if(recovery)recovery.onclick=async()=>{
   if(busy)return;
   const email=doc.getElementById('merchantLoginEmail').value.trim();
   if(!/^\S+@\S+\.\S+$/.test(email)){notice.textContent='Escribe un correo electrónico válido para recuperar tu contraseña.';doc.getElementById('merchantLoginEmail').focus?.();return;}
   password.value='';busy=true;lock(true);notice.textContent='Solicitando recuperación…';
   const success='Si este correo tiene una cuenta con contraseña, recibirás un enlace de recuperación. Revisa también la carpeta de correo no deseado. Si utilizas Google, ingresa con Google.';
   try{await auth.sendPasswordResetEmail(email);notice.textContent=success;}
   catch(error){notice.textContent=error.code==='auth/user-not-found'?success:error.code==='auth/too-many-requests'?'Hay demasiados intentos. Espera unos minutos antes de solicitar otro enlace.':'No se pudo solicitar la recuperación. Revisa la conexión e inténtalo más tarde.';}
   finally{busy=false;lock(false);}
  };

 }
 const api={create,bindLogin};if(typeof module==='object'&&module.exports)module.exports=api;root.VisitaLojaMerchantAccess=api;
})(typeof window==='object'?window:globalThis);
