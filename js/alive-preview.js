/* Small enhancements only; nothing stays hidden if this script is unavailable. */
(() => {
 'use strict';
 function placePhotoControls(){
  const controls=document.querySelector('#inicio .vl-photo-carousel-ui');
  const frame=document.getElementById('mobilePhotoFrame');
  const shell=document.querySelector('#inicio .vl-welcome-shell');
  const host=matchMedia('(max-width:760px)').matches&&frame?frame:shell;
  if(controls&&host&&controls.parentElement!==host)host.append(controls);
 }
 placePhotoControls();
 const photoMedia=matchMedia('(max-width:760px)');
 photoMedia.addEventListener('change',placePhotoControls);
 const hero=document.getElementById('inicio');
 if(hero)new MutationObserver(placePhotoControls).observe(hero,{childList:true,subtree:true});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const root=document.documentElement;
 if(reduced.matches||root.classList.contains('low-data-mode')||!('IntersectionObserver' in window))return;
 const seen=new WeakSet();
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){
   if(!reduced.matches&&!root.classList.contains('low-data-mode'))entry.target.classList.add('vl-alive-enter');
   observer.unobserve(entry.target);
  }
 },{threshold:.12});
 function observe(){
  for(const element of document.querySelectorAll('.vl-mobile-intents>a,.vl-mobile-stories>a,#localesGrid>.local-item:nth-child(-n+9)'))if(!seen.has(element)){seen.add(element);observer.observe(element);}
 }
 observe();
 const main=document.getElementById('main-content');
 if(main)new MutationObserver(observe).observe(main,{childList:true,subtree:true});
})();
