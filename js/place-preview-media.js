(function(root){
 'use strict';
 const el=id=>document.getElementById(id);
 function image(value){if(typeof value!=='string'||!value.trim()||value.startsWith('//'))return '';try{const url=new URL(value,location.origin);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch(_){return '';}}
 function render(place,title,language){const button=el('previewPhotoButton'),photo=el('previewPlacePhoto'),label=el('previewPhotoLabel');if(!button||!photo||!label)return;
  const images=(Array.isArray(place.gallery)?place.gallery:[]).map(item=>image(item?.img)).filter(Boolean);button.hidden=!images.length;
  if(!images.length){photo.removeAttribute('src');photo.alt='';label.textContent='';return;}
  photo.alt=title||place.title||'';photo.src=images[0];const en=language==='en';label.textContent=en?`View ${images.length} ${images.length===1?'photo':'photos'} ↗`:`Ver ${images.length} ${images.length===1?'foto':'fotos'} ↗`;button.setAttribute('aria-label',en?'View photos of '+photo.alt:'Ver fotografías de '+photo.alt);
 }
 el('previewPlacePhoto')?.addEventListener('error',()=>{el('previewPhotoButton').hidden=true;});
 root.VisitaLojaPlacePreviewMedia={render};
})(window);
