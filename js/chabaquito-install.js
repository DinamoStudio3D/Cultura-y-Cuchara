/* A delayed invitation in the page flow; native installation belongs to app-install.js. */
(() => {
 'use strict';
 const panel=document.getElementById('vl-chabaquito-install'),accept=document.getElementById('vl-install-accept');
 if(!panel||!accept)return;
 const search=document.querySelector('#inicio .vl-welcome-search');
 if(search)search.insertAdjacentElement('afterend',panel);
 panel.removeAttribute('aria-modal');panel.setAttribute('role','region');
 const key='vl-chabaquito-install-dismissed-v2',force=new URLSearchParams(location.search).has('probarInstalacion');
 let knownInstalled=false,busy=false;
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const dismissed=()=>{try{return localStorage.getItem(key)==='1'}catch(_){return false}};
 const hide=()=>{panel.classList.remove('vl-install-visible');try{localStorage.setItem(key,'1')}catch(_){}};
 document.getElementById('vl-install-close').addEventListener('click',hide);
 document.getElementById('vl-install-later').addEventListener('click',hide);
 window.addEventListener('appinstalled',()=>{knownInstalled=true;hide()});
 accept.addEventListener('click',async()=>{
  if(busy)return;busy=true;accept.disabled=true;
  try{
   const outcome=typeof window.requestVisitaLojaInstall==='function'?await window.requestVisitaLojaInstall():false;
   if(outcome==='accepted'||outcome==='dismissed'){knownInstalled=outcome==='accepted';hide();return;}
   const help=document.getElementById('vl-install-help');
   if(help){help.textContent=/iPad|iPhone|iPod/.test(navigator.userAgent)?'En Safari, pulsa Compartir y luego «Añadir a pantalla de inicio».':'Abre el menú de tu navegador y busca «Instalar aplicación» o «Añadir a pantalla de inicio». Si no aparece, puedes seguir usando la web.';help.hidden=false;}
  }finally{busy=false;accept.disabled=false;}
 });
 const initialize=async()=>{
  if(standalone())return;
  if(typeof navigator.getInstalledRelatedApps==='function')try{const apps=await Promise.race([navigator.getInstalledRelatedApps(),new Promise(resolve=>setTimeout(()=>resolve([]),1000))]);if(Array.isArray(apps)&&apps.some(app=>app.platform==='webapp'||app.platform==='play')){knownInstalled=true;return}}catch(_){}
  setTimeout(()=>{if(!standalone()&&!knownInstalled&&(force||!dismissed()))panel.classList.add('vl-install-visible')},3000);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
