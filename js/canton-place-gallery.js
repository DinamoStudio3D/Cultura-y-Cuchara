(function(root){
 'use strict';
 const el=id=>document.getElementById(id),dialog=el('cantonPhotoDialog');if(!dialog)return;
 let photos=[],index=0,title='',opener;
 function render(){const image=el('cantonGalleryImage');image.hidden=false;image.src=photos[index];image.alt='Fotografía '+(index+1)+' de '+title;el('cantonGalleryStatus').textContent=(index+1)+' de '+photos.length;el('cantonGalleryPrev').disabled=photos.length<2;el('cantonGalleryNext').disabled=photos.length<2;}
 function open(place,button){const gallery=Array.isArray(place.gallery)?place.gallery:[];photos=gallery.map(item=>root.VisitaLojaCantonContent.image(item?.img)).filter(Boolean);if(!photos.length)return;index=0;title=String(place.title||'Lugar');opener=button;el('cantonGalleryTitle').textContent=title;render();dialog.showModal();document.body.classList.add('canton-gallery-open');}
 function step(delta){if(!dialog.open||!photos.length)return;index=(index+delta+photos.length)%photos.length;render();}
 el('cantonGalleryClose').addEventListener('click',()=>dialog.close());el('cantonGalleryPrev').addEventListener('click',()=>step(-1));el('cantonGalleryNext').addEventListener('click',()=>step(1));
 dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();step(event.key==='ArrowLeft'?-1:1);}});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
 dialog.addEventListener('close',()=>{document.body.classList.remove('canton-gallery-open');el('cantonGalleryImage').removeAttribute('src');photos=[];opener?.focus?.();});
 el('cantonGalleryImage').addEventListener('error',()=>{el('cantonGalleryImage').hidden=true;el('cantonGalleryStatus').textContent='No se pudo cargar la foto '+(index+1)+'. Puedes pasar a otra fotografía.';});
 root.VisitaLojaCantonGallery={open};
})(window);
