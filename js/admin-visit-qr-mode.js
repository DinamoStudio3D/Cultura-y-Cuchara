"use strict";

(function (root) {
  const visitApi = root.VisitaLojaVisitValidationAdmin;
  const FALLBACK_MODE = "merchant_confirmation";
  const SELF_CHECKIN_MODE = "self_checkin";
  function normalizeMode(value) {if (visitApi?.normalizeAdminVisitValidationMode) return visitApi.normalizeAdminVisitValidationMode(value);return value === SELF_CHECKIN_MODE ? SELF_CHECKIN_MODE : FALLBACK_MODE;}
  function visitQrMeta(place = {}) {const mode = normalizeMode(place.validationMode);const selfCheckin = mode === SELF_CHECKIN_MODE;return Object.freeze({mode,selfCheckin,requiresMerchantConfirmation: !selfCheckin,loyaltyAllowed: !selfCheckin,purpose: selfCheckin ? "visit_self_checkin" : "visit_merchant_confirmation",label: selfCheckin ? "QR de visita sin encargado" : "QR de visita con encargado",description: selfCheckin ? "Este QR identifica una visita autogestionada para Pasaporte/Misiones. No concede sellos de fidelidad comercial." : "Este QR mantiene la confirmación por personal autorizado y puede participar en Fidelidad cuando corresponda."});}
  function buildVisitQrDescriptor(place = {}, placeId = "") {const meta = visitQrMeta(place);const id = String(placeId || place.id || "").trim();if (!id) throw new Error("placeId es obligatorio para preparar un QR de visita.");return Object.freeze({placeId:id,validationMode:meta.mode,purpose:meta.purpose,requiresMerchantConfirmation:meta.requiresMerchantConfirmation,loyaltyAllowed:meta.loyaltyAllowed});}
  function applyVisitModeToQrConfig(config = {}, place = {}, placeId = "") {const descriptor = buildVisitQrDescriptor(place, placeId);return Object.freeze({...config,visit:descriptor,validationMode:descriptor.validationMode,visitPurpose:descriptor.purpose,requiresMerchantConfirmation:descriptor.requiresMerchantConfirmation,loyaltyAllowed:descriptor.loyaltyAllowed});}
  function describeVisitQr(place = {}) {const meta = visitQrMeta(place);return Object.freeze({title:meta.label,description:meta.description,warning:meta.loyaltyAllowed ? "La fidelidad conserva su validación comercial habitual." : "Este QR no debe acreditar sellos ni recompensas de fidelidad."});}
  root.VisitaLojaVisitQrMode = Object.freeze({visitQrMeta,buildVisitQrDescriptor,applyVisitModeToQrConfig,describeVisitQr});
})(typeof window !== "undefined" ? window : globalThis);

// Admin audio upload UI. Temporary integration point while the admin audio module is isolated.
(function(root){
  'use strict';
  const MAX=20*1024*1024;
  function auth(){try{return root.eval('auth');}catch(_){return null;}}
  function setStatus(node,text,tone=''){if(!node)return;node.textContent=text;node.className=`text-xs ${tone==='ok'?'text-emerald-300':tone==='error'?'text-red-300':'text-gray-400'}`;}
  function cleanLegacyControls(card,box){
    card.querySelectorAll('button').forEach(btn=>{if(box.contains(btn))return;const text=String(btn.textContent||'').trim().toLowerCase();if(text==='quitar'||text.includes('subir audio'))btn.remove();});
    card.querySelectorAll('[data-audio-file],[data-audio-pick],[data-audio-status]').forEach(node=>{if(!box.contains(node))node.remove();});
  }
  async function upload(file,language,status,button,field,card){
    if(!file)return;if(file.size>MAX){setStatus(status,'El audio debe pesar máximo 20 MB.','error');return;}if(!String(file.type||'audio/mpeg').startsWith('audio/')){setStatus(status,'Selecciona un archivo de audio válido.','error');return;}
    const user=auth()?.currentUser;if(!user){setStatus(status,'Debes iniciar sesión nuevamente.','error');return;}
    const placeKey=()=>['placeEditId','placeTitle'].map(id=>document.getElementById(id)?.value||'').join('|');const initialPlace=placeKey();
    const fieldDisabled=field.disabled;field.disabled=true;root.VisitaLojaMediaGuard?.begin('placeForm','audio-'+language);
    button.disabled=true;setStatus(status,'Preparando… 5%');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),150000);
    try{
      const token=await user.getIdToken();setStatus(status,'Autorizando subida de audio…');
      const response=await fetch('/api/sign-time-audio',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
      const signed=await response.json();
      if(!response.ok)throw new Error(signed.error||`Error HTTP ${response.status}`);
      if(!/^[A-Za-z0-9_-]+$/.test(signed.cloudName||'')||!/^[a-f0-9]{40}$/.test(signed.signature||'')||!signed.apiKey||!Number.isSafeInteger(signed.params?.timestamp)||signed.params?.folder!=='visitaloja/time/audio')throw new Error('La autorización de audio no es válida.');
      const body=new FormData();body.append('file',file,file.name);body.append('folder',signed.params.folder);body.append('timestamp',String(signed.params.timestamp));body.append('api_key',signed.apiKey);body.append('signature',signed.signature);
      setStatus(status,'Subiendo audio a Cloudinary…');
      const uploaded=await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/video/upload`,{method:'POST',body,signal:controller.signal});
      const data=await uploaded.json();if(!uploaded.ok)throw new Error(data.error?.message||`Cloudinary rechazó el audio (HTTP ${uploaded.status}).`);
      const url=new URL(data.secure_url);
      if(url.protocol!=='https:'||url.hostname!=='res.cloudinary.com'||url.username||url.password||data.resource_type!=='video'||!String(data.public_id||'').startsWith('visitaloja/time/audio/')||!url.pathname.startsWith('/'+signed.cloudName+'/video/upload/'))throw new Error('Cloudinary no devolvió una URL de audio válida.');
      if(placeKey()!==initialPlace)throw new Error('La parada cambió. Vuelve a seleccionar el audio.');
      if(auth()?.currentUser?.uid!==user.uid)throw new Error('La sesión cambió. Vuelve a iniciar la subida.');
      const publicAudioUrl=url.href;
      field.value=publicAudioUrl;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
      const preview=card.querySelector('audio')||document.getElementById(language==='en'?'placeAudioPreviewEn':'placeAudioPreviewEs');
      if(preview){preview.src=publicAudioUrl;preview.classList.remove('hidden');preview.load();}
      if(typeof root.setAdminUnsavedChanges==='function')root.setAdminUnsavedChanges(true);setStatus(status,'Audio subido. Escúchalo y guarda la parada para publicarlo.','ok');
    }catch(error){setStatus(status,error?.name==='AbortError'?'La subida superó dos minutos y medio y fue cancelada.':(error?.message||'No se pudo subir el audio.'),'error');console.error('Admin audio upload:',error);}finally{clearTimeout(timer);field.disabled=fieldDisabled;root.VisitaLojaMediaGuard?.end('placeForm','audio-'+language);button.disabled=false;}
  }
  function mountCard(fieldId,language,label){
    const field=document.getElementById(fieldId);if(!field)return;const card=field.parentElement;if(!card)return;let box=card.querySelector('[data-github-audio-ui]');
    if(!box){box=document.createElement('div');box.dataset.githubAudioUi='1';box.className='space-y-2';box.innerHTML=`<div class="flex flex-wrap gap-2"><button type="button" data-pick class="border border-white/15 hover:border-cyan-400 rounded-lg px-3 py-2 text-xs font-black"><i class="fa-solid fa-cloud-arrow-up mr-1"></i>Subir audio ${label}</button><input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" class="hidden"><button type="button" data-remove class="border border-red-500/40 text-red-300 rounded-lg px-3 py-2 text-xs font-bold"><i class="fa-solid fa-trash mr-1"></i>Quitar</button></div><p data-status class="text-xs text-gray-400">MP3 u otro audio compatible · máximo 20 MB.</p>`;field.insertAdjacentElement('afterend',box);const pick=box.querySelector('[data-pick]'),input=box.querySelector('input'),status=box.querySelector('[data-status]');pick.addEventListener('click',()=>input.click());input.addEventListener('change',()=>upload(input.files?.[0],language,status,pick,field,card));box.querySelector('[data-remove]').addEventListener('click',()=>{field.value='';field.dispatchEvent(new Event('input',{bubbles:true}));const preview=card.querySelector('audio');if(preview){preview.removeAttribute('src');preview.load();}setStatus(status,'Audio quitado. Guarda la parada para aplicar el cambio.');});}
    cleanLegacyControls(card,box);
  }
  function mount(){mountCard('placeAudioUrl','es','en español');mountCard('placeAudioUrlEn','en','en inglés');}
  root.addEventListener('DOMContentLoaded',mount);setTimeout(mount,800);setTimeout(mount,2500);
})(typeof window!=='undefined'?window:globalThis);
