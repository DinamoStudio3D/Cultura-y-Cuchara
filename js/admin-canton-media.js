/* Signed uploads only. Uploaded URLs remain drafts until the corresponding form is saved. */
(function(root){
 'use strict';
 const el=id=>document.getElementById(id),jobs=new Map();
 function cancel(group){for(const [name,job] of jobs)if(!group||name===group){job.changed=true;job.controller.abort();}}
 function mount({group,fieldId,formId,endpoint,target,multiple=false}){
  const field=el(fieldId),file=el(group+'MediaFiles'),upload=el(group+'MediaUpload'),stop=el(group+'MediaCancel'),notice=el(group+'MediaNotice');if(!field||!file)return;
  async function start(){if(jobs.has(group))return;const files=Array.from(file.files||[]);if(!files.length){notice.textContent='Selecciona una fotografía.';return;}if(files.length>10){notice.textContent='Selecciona hasta 10 fotografías por tanda.';return;}
   try{files.forEach(image=>root.VisitaLojaImageCompressor.validateImageFile(image,{maxInputBytes:20*1024*1024}));}catch(error){notice.textContent=error.message;return;}
   const user=auth.currentUser;if(!user){notice.textContent='Inicia sesión como administrador.';return;}
   const job={controller:new AbortController(),target:target(),uid:user.uid,changed:false},previous=field.disabled;jobs.set(group,job);root.VisitaLojaMediaGuard.begin(formId,group);field.disabled=true;file.disabled=upload.disabled=true;stop.hidden=false;
   let completed=0,timedOut=false,timer;
   const check=()=>{job.controller.signal.throwIfAborted();if(job.uid!==auth.currentUser?.uid||job.target!==target())throw Object.assign(Error('El formulario cambió.'),{name:'AbortError'});};
   try{
    for(const selected of files){clearTimeout(timer);timer=setTimeout(()=>{timedOut=true;job.controller.abort();},150000);check();notice.textContent=`Optimizando fotografía ${completed+1} de ${files.length}…`;const optimized=await root.VisitaLojaImageCompressor.compressImageClientSide(selected,root.VisitaLojaImageConfig.CONFIG.compression);check();const token=await user.getIdToken();check();notice.textContent='Autorizando subida…';const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:job.controller.signal});const authorization=await response.json().catch(()=>({}));if(!response.ok)throw Error(authorization.error||'No se pudo autorizar la subida.');check();notice.textContent=`Subiendo fotografía ${completed+1} de ${files.length}…`;const result=await root.VisitaLojaCloudinaryUploader.uploadSignedImage(optimized.blob,authorization,{filename:group+'-'+Date.now()+'.webp',signal:job.controller.signal});check();field.value=multiple?[field.value.trim(),result.url].filter(Boolean).join('\n'):result.url;field.dispatchEvent(new Event('input',{bubbles:true}));setAdminUnsavedChanges(true);completed++;}
    file.value='';notice.textContent=`${completed} ${completed===1?'fotografía subida':'fotografías subidas'}. Guarda ${group==='canton'?'la presentación del cantón':'la parada'} para publicarlas.`;
   }catch(error){notice.textContent=job.changed?'La subida se detuvo al cambiar de formulario.':timedOut?'La subida agotó el tiempo disponible.':error.name==='AbortError'?'Subida cancelada.':'No se pudo subir: '+error.message;if(completed&&!job.changed)notice.textContent+=` ${completed} fotos ya añadidas al formulario; guarda para conservarlas.`;
   }finally{clearTimeout(timer);jobs.delete(group);field.disabled=previous;file.disabled=upload.disabled=false;stop.hidden=true;root.VisitaLojaMediaGuard.end(formId,group);}
  }
  upload.addEventListener('click',start);stop.addEventListener('click',()=>jobs.get(group)?.controller.abort());
  el(formId)?.addEventListener('reset',()=>{cancel(group);file.value='';notice.textContent='';});
 }
 root.VisitaLojaCantonMedia={cancel};
 mount({group:'place',fieldId:'placeGallery',formId:'placeForm',endpoint:'/api/sign-time-image?purpose=gallery',target:()=>el('placeEditId').value,multiple:true});
 mount({group:'canton',fieldId:'adminCantonCover',formId:'adminCantonForm',endpoint:'/api/sign-time-image?purpose=canton',target:()=>el('adminCantonSelect').value});
 const cover=el('adminCantonCover'),preview=el('cantonMediaPreview');
 function refreshCover(){if(!preview)return;const url=root.VisitaLojaCantonContent.image(cover.value);preview.hidden=!url;if(url)preview.src=url;else preview.removeAttribute('src');}
 cover?.addEventListener('input',refreshCover);if(preview)preview.addEventListener('error',()=>{preview.hidden=true;el('cantonMediaNotice').textContent='No se pudo visualizar la portada. Revisa el enlace.';});
 root.VisitaLojaCantonMedia.refreshCover=refreshCover;
 auth.onAuthStateChanged(()=>{cancel();if(preview){preview.hidden=true;preview.removeAttribute('src');}});
})(window);
