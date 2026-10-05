(function(global){
'use strict';
const MAX_AUDIO_BYTES=20*1024*1024;
function status(node,text,tone){if(!node)return;node.textContent=text;node.className=`text-xs ${tone==='ok'?'text-emerald-300':tone==='error'?'text-red-300':'text-gray-400'}`;}
function placeId(){const raw=document.getElementById('placeEditId')?.value||document.getElementById('placeTitle')?.value||'nueva-parada';return String(raw).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'nueva-parada';}
function toBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('No se pudo leer el archivo de audio.'));reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');reader.readAsDataURL(file);});}
async function handle(fileInput,event){
 const wrap=fileInput.closest('.space-y-2');if(!wrap)return;
 const target=wrap.previousElementSibling;if(!target||!['placeAudioUrl','placeAudioUrlEn'].includes(target.id))return;
 event.stopImmediatePropagation();event.preventDefault();
 const file=fileInput.files?.[0];if(!file)return;
 const language=target.id==='placeAudioUrlEn'?'en':'es',preview=document.getElementById(language==='es'?'placeAudioPreviewEs':'placeAudioPreviewEn'),pick=wrap.querySelector('[data-audio-pick]'),info=wrap.querySelector('[data-audio-status]');
 if(!String(file.type||'audio/mpeg').startsWith('audio/'))return status(info,'Selecciona un archivo de audio válido.','error');
 if(file.size>MAX_AUDIO_BYTES)return status(info,'El audio supera el límite de 20 MB.','error');
 if(pick)pick.disabled=true;status(info,'Preparando audio…');
 try{
  const app=global.firebase.app('viveLojaAdmin'),user=app.auth().currentUser;if(!user)throw new Error('Debes iniciar sesión nuevamente.');
  const token=await user.getIdToken(),content=await toBase64(file);status(info,'Subiendo audio a GitHub…');
  const response=await fetch('/api/upload-admin-audio',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({placeId:placeId(),language,fileName:file.name||`audio-${language}.mp3`,content})});
  let data=null;try{data=await response.json();}catch(_){}
  if(!response.ok)throw new Error(data?.error||'No se pudo subir el audio a GitHub.');
  target.value=data.path;target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));
  if(preview){preview.src=data.path;preview.classList.remove('hidden');preview.load();}
  if(typeof global.setAdminUnsavedChanges==='function')global.setAdminUnsavedChanges(true);
  status(info,'Audio agregado al proyecto. Guarda la parada para asociarlo.','ok');
 }catch(error){console.error('GitHub audioguide upload',error);status(info,error?.message||'No se pudo subir el audio.','error');}
 finally{if(pick)pick.disabled=false;}
}
document.addEventListener('change',event=>{const input=event.target;if(input?.matches?.('[data-audio-file]'))handle(input,event);},true);
})(window);
