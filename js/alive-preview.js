/* Small enhancements only; nothing stays hidden if this script is unavailable. */
(() => {
 'use strict';
 function previewCopy(){
  const en=document.getElementById('langSelector')?.value==='en';
  const title=document.getElementById('heroTitle'),sub=document.getElementById('heroSubtitle'),badge=document.getElementById('heroBadge');
  const heading=en?'Step outside. <em class="vl-editorial-accent">Discover Loja.</em>':'Hoy se sale <em class="vl-editorial-accent">a descubrir Loja.</em>';
  const description=en?'Local flavours, unexpected corners and a new favourite place. Where shall we start?':'Sabores de aquí, rincones por conocer y tu próximo lugar favorito. ¿Por dónde empezamos?';
  const eyebrow=en?'LOJA, ECUADOR · AT YOUR OWN PACE':'LOJA, ECUADOR · A TU RITMO';
  if(title&&title.innerHTML!==heading)title.innerHTML=heading;
  if(sub&&sub.textContent!==description)sub.textContent=description;
  if(badge&&badge.textContent!==eyebrow)badge.textContent=eyebrow;
 }
 previewCopy();
 window.addEventListener('languagechange',previewCopy);
 const copyRoot=document.querySelector('#inicio .vl-welcome-copy');
 if(copyRoot)new MutationObserver(previewCopy).observe(copyRoot,{childList:true,subtree:true,characterData:true});
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
