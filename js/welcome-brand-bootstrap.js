/* The supplied official logo loads locally first; server settings can update it. */
(function(){
 const local='assets/brand/visitaloja-official.webp';
 let revision=0;
 function loadLogo(raw){
  const currentRevision=++revision;
  let url;try{url=new URL(raw,location.href);if(url.protocol!=='https:'||url.username||url.password)return;}catch{return;}
  const preload=new Image();
  preload.fetchPriority='high';
  preload.onload=()=>{
   const apply=()=>{
    if(currentRevision!==revision||window.__vlBrandLogoServerConfirmed===true)return;
    const image=document.getElementById('splashLogoImg');if(!image)return;
    window.__vlSplashBootstrapLogoUrl=url.href;
    image.onload=()=>{image.parentElement?.classList.add('vl-brand-ready');image.style.visibility='visible';image.classList.remove('opacity-0');const fallback=image.parentElement?.querySelector('[data-splash-brand-fallback]');if(fallback)fallback.hidden=true;window.__vlSplashLogoReady?.();};
    image.src=url.href;
    if(image.complete&&image.naturalWidth>0)image.onload();
   };
   if(document.getElementById('splashLogoImg'))apply();
   else {
    const observer=new MutationObserver(()=>{if(document.getElementById('splashLogoImg')){observer.disconnect();apply();}});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener('DOMContentLoaded',()=>{observer.disconnect();apply();},{once:true});
   }
  };
  preload.src=url.href;
 }
 loadLogo(local);
 // Keep the splash logo fixed during startup; remote branding may update the rest of the site later.
})();
