/* Public business video: validate providers, respect paid benefits, load only on request. */
(function(root){
 'use strict';
 function parse(value){
  try{
   const url=new URL(String(value||'').trim());
   if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
   const host=url.hostname.toLowerCase();let id='';
   if(host==='youtu.be')id=url.pathname.slice(1);
   else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
    id=url.pathname==='/watch'?url.searchParams.get('v'):(url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)||[])[1];
   }
   const youtubeHost=['youtu.be','youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host);
   if(youtubeHost&&!(id&&/^[a-zA-Z0-9_-]{11}$/.test(id)))return null;
   if(id&&/^[a-zA-Z0-9_-]{11}$/.test(id))return{type:'youtube',url:'https://www.youtube.com/watch?v='+id,embed:'https://www.youtube-nocookie.com/embed/'+id+'?playsinline=1&rel=0'};
   if(/\.(mp4|webm)$/i.test(url.pathname))return{type:'file',url:url.href};
  }catch(_){}
  return null;
 }
 function time(value,end){
  if(!value)return 0;
  if(typeof value.toDate==='function')return value.toDate().getTime();
  if(value.seconds!==undefined)return Number(value.seconds)*1000;
  const str=String(value),dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(str);
  return Date.parse(dateOnly?str+(end?'T23:59:59-05:00':'T00:00:00-05:00'):str);
 }
 function eligible(place,benefits,now=Date.now()){
  if(!place||place.publicationStatus&&place.publicationStatus!=='published')return null;
  const s=place.subscription||{},start=time(s.startAt||s.startDate),end=time(s.endAt||s.endDate,true);
  if(!s.plan||s.plan==='free'||['paused','pending','expired','suspended'].includes(s.status)||(start&&now<start)||(end&&now>end))return null;
  if((benefits||s.benefits||{}).video!==true)return null;
  return parse(place.youtubeUrl);
 }
 let dialog,media,title,link,opener,activeId=null,activeUrl=null;
 function close(){if(dialog?.open)dialog.close();}
 function open(place,benefits,language){
  const source=eligible(place,benefits);if(!source)return false;
  const en=language==='en';
  if(!dialog){
   dialog=document.createElement('dialog');dialog.className='vl-business-video-dialog';dialog.setAttribute('aria-labelledby','vlBusinessVideoTitle');
   const header=document.createElement('div');header.className='vl-video-header';title=document.createElement('h2');title.id='vlBusinessVideoTitle';const button=document.createElement('button');button.type='button';button.className='vl-video-close';button.textContent='✕';button.setAttribute('aria-label',en?'Close video':'Cerrar vídeo');button.onclick=close;header.append(title,button);
   media=document.createElement('div');media.className='vl-video-player';link=document.createElement('a');link.target='_blank';link.rel='noopener noreferrer';link.className='vl-video-original';dialog.append(header,media,link);document.body.append(dialog);
   dialog.addEventListener('close',()=>{if(dialog.open)return;media.replaceChildren();activeId=null;activeUrl=null;if(opener?.isConnected)opener.focus();});
   dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  }
  media.replaceChildren();opener=document.activeElement;activeId=String(place.id);activeUrl=source.url;
  title.textContent=(en?'Meet ':'Conoce ')+((en&&place.titleEn)||place.title||'');
  const player=document.createElement(source.type==='youtube'?'iframe':'video');
  if(source.type==='youtube'){
   player.title=(en?'Business video: ':'Vídeo del negocio: ')+((en&&place.titleEn)||place.title||'');player.allow='encrypted-media; picture-in-picture; fullscreen';player.allowFullscreen=true;player.referrerPolicy='strict-origin-when-cross-origin';player.src=source.embed;
  }else{player.controls=true;player.playsInline=true;player.preload='metadata';player.src=source.url;player.addEventListener('error',()=>{if(!dialog.open||media.firstElementChild!==player)return;media.replaceChildren();const text=document.createElement('p');text.textContent=en?'This video could not be loaded. Open the original link below.':'No se pudo cargar el vídeo. Puedes abrir el enlace original de abajo.';media.append(text);});}
  media.append(player);link.href=source.url;link.textContent=en?'Open original video ↗':'Abrir vídeo original ↗';
  dialog.querySelector('.vl-video-close').setAttribute('aria-label',en?'Close video':'Cerrar vídeo');
  if(!dialog.open)dialog.showModal();return true;
 }
 function sync(places,benefitsFor){if(activeId!==null){const place=places.find(p=>String(p.id)===activeId);const source=eligible(place,place&&benefitsFor?.(place));if(!source||source.url!==activeUrl)close();}}
 root.VisitaLojaPlaceVideo={parse,eligible,open,close,sync};
})(window);
