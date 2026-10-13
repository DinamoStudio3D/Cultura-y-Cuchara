/* Standalone pages show only server-confirmed branding, never a cached legacy logo. */
(function(){
 'use strict';
 const targets=[...document.querySelectorAll('[data-public-brand-logo]')];
 if(!targets.length||!window.firebase?.apps?.length)return;
 let revision=0;
 function hide(){for(const img of targets){img.hidden=true;img.removeAttribute('src');}}
 hide();
 firebase.firestore().collection('settings').doc('main').onSnapshot({includeMetadataChanges:true},snapshot=>{
  if(!snapshot.exists||snapshot.metadata.fromCache)return;
  const token=++revision;hide();const raw=snapshot.data().logoUrl;
  if(typeof raw!=='string'||!raw.trim())return;
  let url;try{url=new URL(raw,location.href);if(url.username||url.password||(url.protocol!=='https:'&&url.origin!==location.origin))return;}catch{return;}
  const image=new Image();image.onload=()=>{if(token!==revision)return;for(const img of targets){img.src=url.href;img.hidden=false;}};image.onerror=()=>{if(token===revision)hide();};image.src=url.href;
 },()=>{});
})();
