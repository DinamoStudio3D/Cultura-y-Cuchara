(function(global){
'use strict';
const MAX_AUDIO_BYTES=20*1024*1024;
function validAudio(file){return file instanceof Blob&&file.size>0&&file.size<=MAX_AUDIO_BYTES&&String(file.type||'audio/mpeg').startsWith('audio/');}
async function authorization(app,placeId,language){
 const user=app?.auth?.().currentUser;if(!user)throw new Error('Debes iniciar sesión nuevamente.');
 const token=await user.getIdToken();
 const response=await fetch('/api/sign-admin-audio',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({placeId,language})});
 let data=null;try{data=await response.json();}catch(_){}
 if(!response.ok)throw new Error(data?.error||'No se pudo autorizar la subida del audio.');
 return data;
}
async function upload(file,app,placeId,language,onProgress){
 if(!validAudio(file))throw new Error(file?.size>MAX_AUDIO_BYTES?'El audio supera el límite de 20 MB.':'Selecciona un archivo de audio válido.');
 const auth=await authorization(app,placeId,language),params=auth.params||{};
 const form=new FormData();form.append('file',file,file.name||`audio-${language}.mp3`);['folder','timestamp','upload_preset'].forEach(k=>form.append(k,String(params[k])));form.append('api_key',String(auth.apiKey));form.append('signature',String(auth.signature));
 const url=`https://api.cloudinary.com/v1_1/${encodeURIComponent(auth.cloudName)}/video/upload`;
 return await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',url,true);xhr.upload.onprogress=e=>{if(e.lengthComputable&&typeof onProgress==='function')onProgress(Math.round(e.loaded/e.total*100));};xhr.onerror=()=>reject(new Error('No se pudo conectar con Cloudinary.'));xhr.onload=()=>{let data=null;try{data=JSON.parse(xhr.responseText||'{}');}catch(_){}if(xhr.status<200||xhr.status>=300)return reject(new Error(data?.error?.message?`Cloudinary: ${data.error.message}`:'No se pudo subir el audio a Cloudinary.'));if(!data?.secure_url)return reject(new Error('Cloudinary no devolvió la URL del audio.'));resolve({url:data.secure_url,publicId:data.public_id,bytes:Number(data.bytes)||file.size,format:data.format||null});};xhr.send(form);});
}
global.VisitaLojaCloudinaryAudio=Object.freeze({MAX_AUDIO_BYTES,upload});
})(typeof window!=='undefined'?window:globalThis);
