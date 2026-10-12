/* Fetch only the current public logo early; never use a cached settings logo. */
(function(){
 const endpoint='https://firestore.googleapis.com/v1/projects/cultura-y-cuchara/databases/(default)/documents/settings/main';
 fetch(endpoint,{cache:'no-store'}).then(response=>response.ok?response.json():null).then(data=>{
  const raw=data?.fields?.logoUrl?.stringValue;
  if(!raw)return;
  let url;try{url=new URL(raw,location.href);if(url.protocol!=='https:'||url.username||url.password)return;}catch{return;}
  const preload=new Image();
  preload.onload=()=>{
   const apply=()=>{
    if(window.__vlBrandLogoServerConfirmed===true)return;
    const image=document.getElementById('splashLogoImg');if(!image)return;
    window.__vlSplashBootstrapLogoUrl=url.href;
    image.onload=()=>{image.style.visibility='visible';image.classList.remove('opacity-0');const fallback=image.parentElement?.querySelector('[data-splash-brand-fallback]');if(fallback)fallback.hidden=true;window.__vlSplashLogoReady?.();};
    image.src=url.href;
    if(image.complete&&image.naturalWidth>0)image.onload();
   };
   if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  };
  preload.src=url.href;
 }).catch(()=>{});
})();
