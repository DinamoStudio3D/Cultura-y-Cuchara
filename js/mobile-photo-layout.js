/* Move the actual photo, heading and live author credit together on mobile. */
(function(root){
'use strict';
const doc=root.document;
function init(){
 const hero=doc.getElementById('inicio'),shell=hero?.querySelector('.vl-welcome-shell'),copy=hero?.querySelector('.vl-welcome-copy'),photo=hero?.querySelector('.vl-visible-photo-carousel'),title=doc.getElementById('heroTitle');
 if(!shell||!copy||!photo||!title||doc.getElementById('mobilePhotoFrame'))return;
 const frame=doc.createElement('div');frame.id='mobilePhotoFrame';frame.className='vl-mobile-photo-frame';frame.hidden=true;
 const kicker=doc.createElement('span');kicker.className='vl-mobile-photo-kicker';
 const label=()=>{kicker.textContent=typeof currentLang!=='undefined'&&currentLang==='en'?'DISCOVER LOJA · ECUADOR':'DESCUBRE LOJA · ECUADOR';};label();
 const slots=new Map();
 function reserve(node){if(!slots.has(node)){const marker=doc.createComment('original mobile photo position');node.before(marker);slots.set(node,marker);}}
 reserve(photo);reserve(title);shell.insertBefore(frame,copy);
 const media=root.matchMedia('(max-width:760px)');
 function arrange(){
  const credit=hero.querySelector('.vl-managed-photo-credit');if(credit)reserve(credit);
  if(media.matches){frame.hidden=false;frame.append(photo,kicker,title);if(credit)frame.append(credit);}
  else{for(const[node,marker]of slots)marker.after(node);frame.hidden=true;}
 }
 arrange();media.addEventListener('change',arrange);
 // The photo library may insert its credit after this script initializes.
 const observer=new MutationObserver(()=>{const credit=hero.querySelector('.vl-managed-photo-credit');if(credit&&!slots.has(credit))arrange();});
 observer.observe(copy,{childList:true});
 root.addEventListener('languagechange',label);
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
