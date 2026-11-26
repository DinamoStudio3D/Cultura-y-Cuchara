/* Small enhancements only; nothing stays hidden if this script is unavailable. */
(() => {
 'use strict';
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
