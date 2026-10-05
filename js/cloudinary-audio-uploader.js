(function(global){
'use strict';
const MAX_AUDIO_BYTES=20*1024*1024;
function validAudio(file){return file instanceof Blob&&file.size>0&&file.size<=MAX_AUDIO_BYTES&&String(file.type||'audio/mpeg').startsWith('audio/');}
function toBase64(file,onProgress){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('No se pudo leer el archivo de audio.'));reader.onprogress=e=>{if(e.lengthComputable&&typeof onProgress==='function')onProgress(Math.min(45,5+Math.round(e.loaded/e.total*40)));};reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');reader.readAsDataURL(file);});}
async function upload(file,app,placeId,language,onProgress){
 if(!validAudio(file))throw new Error(file?.size>MAX_AUDIO_BYTES?'El audio supera el límite de 20 MB.':'Selecciona un archivo de audio válido.');
 const user=app?.auth?.().currentUser;if(!user)throw new Error('Debes iniciar sesión nuevamente.');
 if(typeof onProgress==='function')onProgress(2);
 const token=await user.getIdToken();
 const content=await toBase64(file,onProgress);
 if(typeof onProgress==='function')onProgress(50);
 const response=await fetch('/api/upload-admin-audio',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({placeId:String(placeId||'nueva-parada'),language,fileName:file.name||`audio-${language}.mp3`,content})});
 if(typeof onProgress==='function')onProgress(85);
 let data=null;try{data=await response.json();}catch(_){}
 if(!response.ok)throw new Error(data?.error||'No se pudo subir el audio a GitHub.');
 if(!data?.path)throw new Error('GitHub no devolvió la ruta del audio.');
 if(typeof onProgress==='function')onProgress(100);
 return{url:data.path,publicId:data.repositoryPath||data.path,bytes:file.size,format:(file.name?.split('.').pop()||'mp3').toLowerCase(),branch:data.branch||null,commit:data.commit||null};
}
global.VisitaLojaCloudinaryAudio=Object.freeze({MAX_AUDIO_BYTES,upload});
})(typeof window!=='undefined'?window:globalThis);
