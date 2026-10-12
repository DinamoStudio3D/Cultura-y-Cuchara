/* Existing Firebase account login only; no accounts, profiles or grants are created. */
(function(root){
 'use strict';
 function errorMessage(error){
  return ({'auth/unauthorized-domain':'Google no puede iniciar sesión desde este dominio de Preview. El administrador debe autorizar el dominio en Firebase Authentication. Puedes usar correo si tu cuenta ya tiene contraseña.',
   'auth/popup-blocked':'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.',
   'auth/popup-closed-by-user':'La ventana de Google se cerró antes de completar el acceso. Vuelve a intentarlo.',
   'auth/cancelled-popup-request':'Ya había una solicitud de acceso. Espera y vuelve a intentarlo.',
   'auth/network-request-failed':'No se pudo conectar con el servicio de acceso. Revisa tu conexión.',
   'auth/too-many-requests':'Hay demasiados intentos. Espera unos minutos antes de volver a ingresar.',
   'auth/operation-not-allowed':'Este método de acceso no está habilitado. Utiliza el método de tu cuenta o consulta al administrador.',
   'auth/invalid-credential':'No se pudo ingresar con ese correo y contraseña. Revisa los datos.',
   'auth/wrong-password':'No se pudo ingresar con ese correo y contraseña. Revisa los datos.',
   'auth/user-not-found':'No se pudo ingresar con ese correo y contraseña. Revisa los datos.'})[error?.code]||'No se pudo completar el inicio de sesión. Inténtalo nuevamente.';
 }
 function bind(doc,auth,provider){
  const google=doc.getElementById('walletGoogle'),form=doc.getElementById('customerLoginForm'),submit=doc.getElementById('customerLoginSubmit'),notice=doc.getElementById('customerLoginMessage'),login=doc.getElementById('customerLogin'),email=doc.getElementById('customerLoginEmail'),password=doc.getElementById('customerLoginPassword');
  if(!google||!form)return;
  let busy=false;
  const say=text=>{notice.hidden=!text;notice.textContent=text;};
  async function run(action){
   if(busy)return false;busy=true;google.disabled=submit.disabled=true;say('Iniciando sesión…');
   try{await action();say('');return true;}
   catch(error){say(errorMessage(error));return false;}
   finally{password.value='';busy=false;google.disabled=submit.disabled=false;}
  }
  google.onclick=()=>run(()=>auth.signInWithPopup(provider()));
  form.addEventListener('submit',event=>{event.preventDefault();if(busy)return;const value=password.value,account=email.value.trim();password.value='';return run(()=>auth.signInWithEmailAndPassword(account,value));});
  auth.onAuthStateChanged(user=>{login.classList.toggle('hidden',Boolean(user));if(user)say('');});
 }
 root.VisitaLojaCustomerLogin={bind,errorMessage};
 if(root.document?.getElementById('walletGoogle')&&typeof auth!=='undefined')bind(document,auth,()=>new firebase.auth.GoogleAuthProvider());
})(window);
