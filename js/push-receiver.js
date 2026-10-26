/* Receive opted-in messages while the home page is open. Never requests permission. */
(function(){
 'use strict';
 let started=false;
 async function start(){
  if(started||!('Notification'in window)||Notification.permission!=='granted'||!window.firebase)return;
  let app;try{app=firebase.app('viveLojaPublic');}catch(_){return;}
  started=true;
  try{
   if(!firebase.messaging)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
   if(!await firebase.messaging.isSupported()){started=false;return;}
   firebase.messaging(app).onMessage(payload=>{
    if(!app.auth().currentUser)return;const data=payload.data||{};let url;try{url=new URL(data.url||'/',location.origin);if(url.origin!==location.origin)return;}catch(_){return;}
    document.getElementById('visitalojaPushNotice')?.remove();
    const host=document.createElement('aside');host.id='visitalojaPushNotice';host.setAttribute('role','status');host.setAttribute('aria-live','polite');host.style.cssText='position:fixed;bottom:24px;left:16px;right:16px;max-width:440px;z-index:150;background:#fff;color:#173c43;padding:20px;border:1px solid #b9ceca;border-radius:18px;box-shadow:0 12px 48px #102b4040';
    const title=document.createElement('strong'),body=document.createElement('p'),link=document.createElement('a'),close=document.createElement('button');title.textContent=data.title||'VisitaLoja';body.textContent=data.body||'';body.style.margin='8px 0';link.textContent='Ver aviso →';link.href=url.pathname+url.search+url.hash;link.style.cssText='color:#145d70;text-decoration:underline;font-weight:700';close.type='button';close.textContent='Cerrar';close.style.cssText='float:right;min-height:44px;padding:8px 12px;border:0;border-radius:8px;color:#173c43;background:#edf4f2';close.onclick=()=>host.remove();host.append(title,body,link,close);document.body.append(host);
   });
  }catch(_){started=false;/* A messaging failure must never block the home page. */}
 }
 window.VisitaLojaPushReceiver={start};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
