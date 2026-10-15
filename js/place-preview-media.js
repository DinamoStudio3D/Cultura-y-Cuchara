(function(root){
 'use strict';
 const el=id=>document.getElementById(id);
 const fallback='/assets/photos/photo-unavailable.svg';
 function image(value){if(typeof value!=='string'||!value.trim()||value.startsWith('//'))return '';try{const url=new URL(value,location.origin);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch(_){return '';}}
 let activeSources=[],sourceIndex=0;
 function render(place,title,language){
  const button=el('previewPhotoButton'),photo=el('previewPlacePhoto'),label=el('previewPhotoLabel');
  if(!button||!photo||!label)return;
  const gallery=(Array.isArray(place.gallery)?place.gallery:[]).map(item=>image(item?.img)).filter(Boolean);
  const isCodeproim=place.category==='aliado'&&/codeproim/i.test(String(place.title||title||''));
  const partnerLogo=isCodeproim?image('https://i.imgur.com/qt6cyZR.png'):(place.category==='aliado'?image(place.customLogoUrl):'');
  activeSources=partnerLogo?[partnerLogo,...gallery.filter(url=>url!==partnerLogo)]:gallery;
  sourceIndex=0;
  button.hidden=!activeSources.length;
  if(!activeSources.length){photo.removeAttribute('src');photo.alt='';label.textContent='';return;}
  const en=language==='en';
  photo.alt=partnerLogo?(en?'Logo of ':'Logo de ')+(title||place.title||''):(title||place.title||'');
  photo.src=activeSources[0];
  label.textContent=partnerLogo?(en?'View brand logo ↗':'Ver logo de la marca ↗'):(en?`View ${gallery.length} ${gallery.length===1?'photo':'photos'} ↗`:`Ver ${gallery.length} ${gallery.length===1?'foto':'fotos'} ↗`);
  button.setAttribute('aria-label',partnerLogo?(en?'View brand logo of ':'Ver logo de ')+(title||place.title||''):(en?'View photos of ':'Ver fotografías de ')+(title||place.title||''));
 }
 el('previewPlacePhoto')?.addEventListener('error',()=>{
  const photo=el('previewPlacePhoto'),button=el('previewPhotoButton');
  if(!photo||!button)return;
  sourceIndex++;
  if(sourceIndex<activeSources.length){photo.src=activeSources[sourceIndex];return;}
  photo.onerror=null;
  photo.src=fallback;
  button.hidden=true;
 });
 root.VisitaLojaPlacePreviewMedia={render};
})(window);
