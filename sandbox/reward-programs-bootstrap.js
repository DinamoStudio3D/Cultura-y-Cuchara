(function(){
 'use strict';
 const el=id=>document.getElementById(id),account=el('accountStatus'),workspace=el('workspaceStatus');
 let app,client,active='customer',views=new Map(),editor,sessionGeneration=0;
 function clear(){for(const view of views.values())view.dispose();views.clear();if(editor){editor.reset();el('editor').hidden=true;}for(const pane of ['customer','merchant','publication'])el(pane).replaceChildren();}
 function select(pane){
  if(!app.auth().currentUser)return;
  active=pane;for(const key of ['customer','merchant','editor','publication'])el(key).hidden=key!==pane;
  document.querySelectorAll('[data-pane]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.pane===pane)));
  workspace.textContent='';
  try{
   if(pane==='editor'){if(!editor)editor=VisitaLojaAdminRewardPrograms.mountIsolated(el('editor'),client);else editor.reload();}
   else if(!views.has(pane))views.set(pane,VisitaLojaRewardProgramsPortal[pane](el(pane),{app,client}));
  }catch(_){workspace.textContent='No se pudo abrir este apartado. Recarga e inténtalo nuevamente.';}
 }
 function lock(value){el('loginForm').querySelectorAll('input,button').forEach(control=>control.disabled=value);}
 async function login(action){lock(true);account.textContent='Ingresando…';try{await action();}catch(_){account.textContent='No se pudo ingresar. Revisa tu cuenta o inténtalo nuevamente.';}finally{el('password').value='';lock(false);}}
 async function start(){
  try{
   const response=await fetch('/sandbox/config.json',{cache:'no-store',credentials:'omit'});if(!response.ok)throw Error();
   const config=await response.json();if(!config.firebase?.projectId||config.firebase.projectId==='cultura-y-cuchara')throw Error();
   app=firebase.initializeApp(config.firebase,'rewardProgramsSandbox');
   await app.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
   client=VisitaLojaRewardProgramsClient.create({app,endpoint:location.origin});
   el('loginForm').onsubmit=event=>{event.preventDefault();login(()=>app.auth().signInWithEmailAndPassword(el('email').value.trim(),el('password').value));};
   el('googleLogin').onclick=()=>login(()=>app.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()));
   el('logout').onclick=async()=>{el('logout').disabled=true;try{await app.auth().signOut();}catch(_){account.textContent='No se pudo cerrar la sesión. Inténtalo nuevamente.';}finally{el('logout').disabled=false;}};
   document.querySelectorAll('[data-pane]').forEach(button=>button.onclick=()=>select(button.dataset.pane));
   app.auth().onAuthStateChanged(async user=>{
    const generation=++sessionGeneration;clear();el('loginForm').hidden=!!user;el('logout').hidden=!user;el('navigation').hidden=!user;
    document.querySelectorAll('[data-pane="editor"],[data-pane="publication"]').forEach(button=>button.hidden=true);
    account.textContent=user?'Sesión iniciada: '+(user.email||'Cuenta de pruebas'):'Ingresa con tu cuenta de este entorno.';
    if(!user){workspace.textContent='';el('password').value='';return;}
    select('customer');
    // Server-side authorization controls visibility; no client email whitelist.
    try{await client.call('admin/load',{});if(generation!==sessionGeneration)return;document.querySelectorAll('[data-pane="editor"],[data-pane="publication"]').forEach(button=>button.hidden=false);}catch(_){}
   });
  }catch(_){lock(true);account.textContent='Este entorno todavía no está configurado. No se ha conectado a los datos de la web pública.';}
 }
 lock(true);start().then(()=>{if(app)lock(false);});
})();
