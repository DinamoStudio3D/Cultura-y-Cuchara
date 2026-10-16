/* Account provisioning stays isolated; Firestore remains the authority for grants. */
(function(root){
 'use strict';
 async function canManage(user,{legacyEmail,adminUsers}){
  if(!user?.uid)return false;
  try{
   const token=await user.getIdTokenResult(),claims=token.claims||{};
   if(claims.admin===true||claims.role==='admin'||claims.email===legacyEmail)return true;
   const doc=await adminUsers.doc(user.uid).get(),data=doc.exists?doc.data():null;
   return data?.active===true&&data.role==='admin';
  }catch(_){return false;}
 }
 function createController(deps){
  let busy=false;
  async function create(input){
   if(busy)return {status:'busy'};
   busy=true;let uid=null,granted=false;const actor=deps.auth.currentUser;
   try{
    if(!actor||!await deps.authorize(actor)||deps.auth.currentUser?.uid!==actor.uid)throw {code:'access/unauthorized'};
    const email=String(input.email||'').trim().toLowerCase(),displayName=String(input.displayName||'').trim(),role=input.role;
    if(email===deps.legacyEmail)throw {code:'access/protected'};
    if(!displayName||displayName.length>80||!/^\S+@\S+\.\S+$/.test(email)||typeof input.password!=='string'||input.password.length<8||!['admin','owner'].includes(role))throw {code:'input/invalid'};
    await deps.secondary.setPersistence(deps.persistence);
    const credential=await deps.secondary.createUserWithEmailAndPassword(email,input.password);uid=credential.user.uid;
    if(deps.auth.currentUser?.uid!==actor.uid||!await deps.authorize(actor)||deps.auth.currentUser?.uid!==actor.uid)throw {code:'access/session-changed'};
    await credential.user.updateProfile({displayName});
    if(deps.auth.currentUser?.uid!==actor.uid)throw {code:'access/session-changed'};
    await deps.grant(uid,{email,displayName,role,active:true,createdAt:deps.timestamp(),updatedAt:deps.timestamp(),updatedBy:actor.uid});granted=true;
    // Audit is secondary to the already completed grant.
    if(deps.auth.currentUser?.uid===actor.uid){try{await deps.audit({uid,email,role});}catch(_){return {status:'complete',uid,auditPending:true};}}
    return {status:'complete',uid};
   }catch(error){return {status:granted?'complete':uid?'partial':'failed',uid,code:String(error?.code||'operation/failed')};}
   finally{await deps.secondary.signOut().catch(()=>{});busy=false;}
  }
  return {create};
 }
 function outcome(result){
  if(result.status==='complete')return 'Administrador creado correctamente. Entrega la contraseña temporal de forma privada.'+(result.auditPending?' El registro de auditoría no pudo confirmarse.':'');
  if(result.status==='partial')return 'Se creó la cuenta de acceso, pero no se pudo confirmar el permiso administrativo. No vuelvas a crearla ni cambies su contraseña. Revisa el acceso antes de reintentar. Referencia: '+result.uid;
  return ({'auth/email-already-in-use':'Ese correo ya tiene una cuenta. No se modificó su contraseña.','auth/weak-password':'La contraseña temporal debe tener al menos 8 caracteres.','auth/invalid-email':'Escribe un correo electrónico válido.','access/unauthorized':'Tu cuenta no puede gestionar administradores. Consulta al propietario de la plataforma.','access/protected':'La cuenta principal ya tiene acceso protegido.','input/invalid':'Revisa el nombre, correo, contraseña y rol antes de crear la cuenta.'})[result.code]||'No se pudo confirmar la creación. Comprueba el acceso antes de reintentar.';
 }
 root.VisitaLojaAdminAccountManagement={canManage,createController,outcome};
})(window);
