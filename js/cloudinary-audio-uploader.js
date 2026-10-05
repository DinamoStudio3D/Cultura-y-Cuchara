(function(global){
'use strict';
const MAX_AUDIO_BYTES=4*1024*1024;
function validAudio(file){return file instanceof Blob&&file.size>0&&file.size<=MAX_AUDIO_BYTES&&String(file.type||'audio/mpeg').startsWith('audio/');}
async function upload(file,app,placeId,language,onProgress){
 if(!validAudio(file))throw new Error(file?.size>MAX_AUDIO_BYTES?'Para subir directamente a GitHub el audio debe pesar máximo 4 MB.':'Selecciona un archivo de audio válido.');
 const user=app?.auth?.().currentUser;if(!user)throw new Error('Debes iniciar sesión nuevamente.');
 if(typeof onProgress==='function')onProgress(5);
 const token=await user.getIdToken();
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);
 try{
  if(typeof onProgress==='function')onProgress(15);
  const params=new URLSearchParams({placeId:String(placeId||'nueva-parada'),language,fileName:file.name||`audio-${language}.mp3`});
  const response=await fetch(`/api/upload-admin-audio?${params.toString()}`,{method:'POST',headers:{'Content-Type':file.type||'audio/mpeg','Authorization':`Bearer ${token}`},body:file,signal:controller.signal});
  if(typeof onProgress==='function')onProgress(90);
  let data=null;try{data=await response.json();}catch(_){}
  if(!response.ok)throw new Error(data?.error||`No se pudo subir el audio (HTTP ${response.status}).`);
  if(!data?.path)throw new Error('GitHub no devolvió la ruta del audio.');
  if(typeof onProgress==='function')onProgress(100);
  return{url:data.path,publicId:data.repositoryPath||data.path,bytes:file.size,format:(file.name?.split('.').pop()||'mp3').toLowerCase(),branch:data.branch||null,commit:data.commit||null};
 }catch(error){if(error?.name==='AbortError')throw new Error('La subida tardó demasiado y fue cancelada. Intenta nuevamente.');throw error;}finally{clearTimeout(timer);}
}
global.VisitaLojaCloudinaryAudio=Object.freeze({MAX_AUDIO_BYTES,upload});
})(typeof window!=='undefined'?window:globalThis);
