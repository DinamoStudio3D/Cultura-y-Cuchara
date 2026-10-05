(function(global){
'use strict';
function status(node,text,tone){if(!node)return;node.textContent=text;node.className=`text-xs ${tone==='ok'?'text-emerald-300':tone==='error'?'text-red-300':'text-gray-400'}`;}
function placeId(){const raw=document.getElementById('placeEditId')?.value||document.getElementById('placeTitle')?.value||'nueva-parada';return String(raw).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,180)||'nueva-parada';}
async function handle(fileInput,event){
 const wrap=fileInput.closest('.space-y-2');if(!wrap)return;
 const target=wrap.previousElementSibling;if(!target||!['placeAudioUrl','placeAudioUrlEn'].includes(target.id))return;
 event.stopImmediatePropagation();event.preventDefault();
 const file=fileInput.files?.[0];if(!file)return;
 const language=target.id==='placeAudioUrlEn'?'en':'es',preview=document.getElementById(language==='es'?'placeAudioPreviewEs':'placeAudioPreviewEn'),pick=wrap.querySelector('[data-audio-pick]'),info=wrap.querySelector('[data-audio-status]');
 if(pick)pick.disabled=true;status(info,'Preparando subida a Cloudinary…');
 try{
  const app=global.firebase.app('viveLojaAdmin');
  const result=await global.VisitaLojaCloudinaryAudio.upload(file,app,placeId(),language,p=>status(info,`Subiendo… ${p}%`));
  target.value=result.url;target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));
  if(preview){preview.src=result.url;preview.classList.remove('hidden');preview.load();}
  if(typeof global.setAdminUnsavedChanges==='function')global.setAdminUnsavedChanges(true);
  status(info,'Audio subido correctamente. Guarda la parada para asociarlo.','ok');
 }catch(error){console.error('Cloudinary audioguide upload',error);status(info,error?.message||'No se pudo subir el audio.','error');}
 finally{if(pick)pick.disabled=false;}
}
document.addEventListener('change',event=>{const input=event.target;if(input?.matches?.('[data-audio-file]')&&global.VisitaLojaCloudinaryAudio)handle(input,event);},true);
})(window);
