/* Shared URL checks and passive player feedback. No uploads, writes or autoplay. */
(function(root){
 'use strict';
 function safeMediaUrl(value){
  if(typeof value!=='string')return '';
  const raw=value.trim();if(!raw||/[\x00-\x20\\]/.test(raw)||raw.startsWith('//'))return '';
  try{const url=new URL(raw,'https://visitaloja.com/');if(url.protocol!=='https:'||url.username||url.password)return '';if(/^[a-z][a-z\d+.-]*:/i.test(raw)&&!raw.startsWith('https://'))return '';return raw;}catch{return '';}
 }
 function init(){const audio=document.getElementById('podcastSampleAudio'),error=document.getElementById('podcastAudioError');if(!audio||!error||audio.dataset.feedbackReady)return;audio.dataset.feedbackReady='true';const show=()=>{error.hidden=false;},hide=()=>{error.hidden=true;};audio.addEventListener('error',show);audio.querySelector('source')?.addEventListener('error',show);audio.addEventListener('loadstart',hide);audio.addEventListener('loadedmetadata',hide);audio.addEventListener('playing',hide);if(audio.error)show();}
 root.VisitaLojaPodcastMedia={safeMediaUrl,init};
 if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
})(typeof window!=='undefined'?window:globalThis);
