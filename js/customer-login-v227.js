/* Explicit customer account actions; no administrative grants or loyalty writes. */
(function(root){
 'use strict';
 function errorMessage(error){
  if(root.VisitaLojaAccountAccess&&['auth/unauthorized-domain','auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request','auth/account-exists-with-different-credential','auth/credential-already-in-use','auth/user-disabled','auth/web-storage-unsupported','auth/operation-not-supported-in-this-environment'].includes(error?.code))return root.VisitaLojaAccountAccess.errorMessage(error);
  return ({'auth/unauthorized-domain':'Google no puede iniciar sesión desde este dominio de Preview. El administrador debe autorizar el dominio en Firebase Authentication. Puedes usar correo si tu cuenta ya tiene contraseña.',
   'auth/popup-blocked':'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.',
   'auth/popup-closed-by-user':'La ventana de Google se cerró antes de completar el acceso. Vuelve a intentarlo.',
   'auth/cancelled-popup-request':'Ya había una solicitud de acceso. Espera y vuelve a intentarlo.',
   'auth/network-request-failed':'No se pudo conectar con el servicio de acceso. Revisa tu conexión.',
   'auth/too-many-requests':'Hay demasiados intentos. Espera unos minutos antes de volver a ingresar.',
   'auth/operation-not-allowed':'Este método de acceso no está habilitado. Utiliza el método de tu cuenta o consulta al administrador.',
   'auth/invalid-credential':'No se pudo ingresar con ese correo y contraseña. Revisa los datos.',
   'auth/wrong-password':'No se pudo ingresar con ese correo y contraseña. Revisa los datos.',
   'auth/user-not-found':'No se pudo ingresar con ese correo y contraseña. Revisa los datos.',
   'auth/email-already-in-use':'Ese correo ya tiene una cuenta. Ingresa con tu método actual o solicita recuperar la contraseña.',
   'auth/weak-password':'Usa una contraseña de al menos 8 caracteres.',
   'auth/password-does-not-meet-requirements':'La contraseña no cumple la política de seguridad de la cuenta. Elige una contraseña más segura.',
   'auth/invalid-email':'Escribe un correo electrónico válido.'})[error?.code]||'No se pudo completar el inicio de sesión. Inténtalo nuevamente.';
 }
 function bind(doc,auth,provider){
  const google=doc.getElementById('walletGoogle'),form=doc.getElementById('customerLoginForm'),submit=doc.getElementById('customerLoginSubmit'),notice=doc.getElementById('customerLoginMessage'),login=doc.getElementById('customerLogin'),email=doc.getElementById('customerLoginEmail'),password=doc.getElementById('customerLoginPassword');
  if(!google||!form)return;
  const toggle=doc.getElementById('customerToggleRegister'),reset=doc.getElementById('customerResetPassword'),confirm=doc.getElementById('customerPasswordConfirm'),confirmLabel=doc.getElementById('customerPasswordConfirmLabel');
  let busy=false,register=false;
  const say=text=>{notice.hidden=!text;notice.textContent=text;};
  const lock=value=>{for(const node of [google,submit,toggle,reset])if(node)node.disabled=value;};
  const clearSecrets=()=>{password.value='';if(confirm)confirm.value='';};
  async function run(action,{pending='Iniciando sesión…',success=''}={}){
   if(busy)return false;busy=true;lock(true);say(pending);
   try{await action();say(success);return true;}
   catch(error){say(errorMessage(error));return false;}
   finally{clearSecrets();busy=false;lock(false);}
  }
  google.onclick=()=>run(()=>root.VisitaLojaAccountAccess?root.VisitaLojaAccountAccess.google(auth,provider):auth.signInWithPopup(provider()));
  form.addEventListener('submit',event=>{
   event.preventDefault();if(busy)return;
   const value=password.value,account=email.value.trim();
   if(!/^\S+@\S+\.\S+$/.test(account)){say('Escribe un correo electrónico válido.');return;}
   if(register&&(value.length<8||value!==confirm.value)){say(value.length<8?'Usa una contraseña de al menos 8 caracteres.':'Las contraseñas no coinciden. Revisa los dos campos.');return;}
   clearSecrets();
   return register?run(()=>auth.createUserWithEmailAndPassword(account,value),{pending:'Creando cuenta de cliente…',success:'Cuenta de cliente creada. Ya puedes consultar tus tarjetas; no se activaron suscripciones ni se añadieron visitas.'}):run(()=>auth.signInWithEmailAndPassword(account,value));
  });
  if(toggle)toggle.onclick=()=>{
   if(busy)return;register=!register;clearSecrets();say('');
   confirmLabel.hidden=!register;confirm.required=register;password.minLength=register?8:0;password.autocomplete=register?'new-password':'current-password';
   submit.textContent=register?'Crear cuenta de cliente':'Ingresar con correo';toggle.textContent=register?'Ya tengo cuenta: ingresar':'Crear cuenta de cliente';email.focus?.();
  };
  if(reset)reset.onclick=()=>{
   if(busy)return;const account=email.value.trim();
   if(!/^\S+@\S+\.\S+$/.test(account)){say('Escribe tu correo para solicitar la recuperación.');email.focus?.();return;}
   clearSecrets();
   const success='Si este correo tiene una cuenta con contraseña, recibirás un enlace de recuperación. Revisa el correo no deseado. Si utilizas Google, ingresa con Google.';
   return run(async()=>{try{await auth.sendPasswordResetEmail(account);}catch(error){if(error.code!=='auth/user-not-found')throw error;}},{pending:'Solicitando recuperación…',success});
  };
  auth.onAuthStateChanged(user=>{login.classList.toggle('hidden',Boolean(user));clearSecrets();if(user)say('');});

 }
 root.VisitaLojaCustomerLogin={bind,errorMessage};
 if(root.document?.getElementById('walletGoogle')&&typeof auth!=='undefined')bind(document,auth,()=>new firebase.auth.GoogleAuthProvider());
})(window);
