/* Optional invitation after a first successful profile registration. */
(function(root){
 'use strict';
 function createInvite({window:w,document:doc}){
  const seen=new Set();let current=null;
  const key=uid=>'visitalojaPushInvite:'+uid;
  function decision(uid,value){if(value){seen.add(uid);try{w.localStorage.setItem(key(uid),value);}catch(_){}return true;}try{return seen.has(uid)||!!w.localStorage.getItem(key(uid));}catch(_){return seen.has(uid);}}
  function hide(){current?.remove();current=null;}
  async function request(auth,uid,action,body={}){
   if(auth.currentUser?.uid!==uid)throw Error('La sesión cambió.');
   const idToken=await auth.currentUser.getIdToken();if(auth.currentUser?.uid!==uid)throw Error('La sesión cambió.');
   const response=await w.fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+idToken},body:JSON.stringify({...body,action})});const data=await response.json();
   if(auth.currentUser?.uid!==uid)throw Error('La sesión cambió.');if(!response.ok)throw Error(data.error||'No se pudieron activar los avisos.');return data;
  }
  async function offer({auth,userId:uid}){
   if(!uid||auth.currentUser?.uid!==uid||decision(uid)||!w.Notification||w.Notification.permission==='denied'||!w.navigator?.serviceWorker||!w.PushManager)return false;
   const apple=/iPad|iPhone|iPod/.test(w.navigator.userAgent||'')||/Macintosh/.test(w.navigator.userAgent||'')&&w.navigator.maxTouchPoints>1;
   if(apple&&!w.navigator.standalone&&!w.matchMedia?.('(display-mode: standalone)').matches)return false;
   const host=doc.getElementById('accountReady');if(!host)return false;
   let config;
   try{
    config=await request(auth,uid,'config');let deviceId;try{deviceId=w.localStorage.getItem('visitalojaPushDevice:'+uid);}catch(_){}
    if(deviceId&&(await request(auth,uid,'device',{deviceId})).active){decision(uid,'subscribed');return false;}
   }catch(_){return false;}
   if(auth.currentUser?.uid!==uid||decision(uid))return false;
   hide();decision(uid,'shown');
   const card=doc.createElement('section');current=card;card.className='registration-push-invite';card.setAttribute('aria-label','Invitación opcional a notificaciones');
   const heading=doc.createElement('h3'),message=doc.createElement('p'),actions=doc.createElement('div'),activate=doc.createElement('button'),later=doc.createElement('button'),status=doc.createElement('p'),manage=doc.createElement('a');
   heading.textContent='🔔 Mantente al día con Loja';message.textContent='Recibe novedades, eventos y promociones de VisitaLoja en tu móvil. Tú decides; puedes desactivarlos cuando quieras.';actions.className='registration-push-actions';activate.type=later.type='button';activate.textContent='Activar notificaciones';later.textContent='Ahora no';later.className='registration-push-later';status.setAttribute('role','status');status.setAttribute('aria-live','polite');manage.href='/notifications.html';manage.textContent='Gestionar mis notificaciones';manage.hidden=true;actions.append(activate,later);card.append(heading,message,actions,status,manage);if(host.firstElementChild)host.firstElementChild.after(card);else host.prepend(card);
   let stop;stop=auth.onAuthStateChanged?.(user=>{if(user?.uid!==uid){if(current===card)hide();stop?.();}});
   later.onclick=()=>{decision(uid,'later');if(current===card)hide();stop?.();};
   activate.onclick=async()=>{
    if(activate.disabled||auth.currentUser?.uid!==uid)return;
    // Request permission directly from the visitor's click, before asynchronous loading.
    activate.disabled=later.disabled=true;
    try{
     const permission=await w.Notification.requestPermission();if(auth.currentUser?.uid!==uid)return;
     if(permission!=='granted'){decision(uid,permission==='denied'?'denied':'later');status.textContent='Puedes continuar usando VisitaLoja y activarlas después desde tu cuenta.';activate.hidden=later.hidden=true;manage.hidden=false;return;}
     status.textContent='Activando las notificaciones…';
     if(!w.firebase.messaging)await new Promise((resolve,reject)=>{const script=doc.createElement('script');script.src='https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js';script.onload=resolve;script.onerror=reject;doc.head.append(script);});
     if(!await w.firebase.messaging.isSupported())throw Error('Este navegador no permite activarlas. Consulta las instrucciones desde tu cuenta.');
     const registration=await w.navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/notifications-push/'});
     if(!registration.active)await new Promise((resolve,reject)=>{const worker=registration.installing||registration.waiting;if(!worker)return reject(Error('Recarga para terminar de preparar el dispositivo.'));const timer=w.setTimeout(()=>reject(Error('No se pudo preparar el dispositivo. Puedes reintentarlo desde tu cuenta.')),15000);worker.addEventListener('statechange',()=>{if(worker.state==='activated'){w.clearTimeout(timer);resolve();}else if(worker.state==='redundant'){w.clearTimeout(timer);reject(Error('No se pudo preparar el dispositivo.'));}});});
     if(auth.currentUser?.uid!==uid)return;
     const token=await w.firebase.messaging(w.firebase.app('viveLojaPublic')).getToken({vapidKey:config.vapidKey,serviceWorkerRegistration:registration});if(!token)throw Error('No se pudo activar el dispositivo.');
     const result=await request(auth,uid,'subscribe',{token,consent:true});try{w.localStorage.setItem('visitalojaPushDevice:'+uid,result.deviceId);}catch(_){}decision(uid,'accepted');w.VisitaLojaPushReceiver?.start();status.textContent='¡Listo! Ya puedes recibir novedades de VisitaLoja en este dispositivo.';activate.hidden=later.hidden=true;manage.hidden=false;
    }catch(error){if(auth.currentUser?.uid!==uid)return;status.textContent='Tu registro está completo. '+(error.message||'Puedes activar los avisos después desde tu cuenta.');activate.hidden=later.hidden=true;manage.hidden=false;}
   };
   return true;
  }
  return {offer,hide};
 }
 if(typeof module==='object'&&module.exports)module.exports={createInvite};else root.VisitaLojaRegistrationPushInvite=createInvite({window:root,document:root.document});
})(typeof window==='undefined'?{}:window);
