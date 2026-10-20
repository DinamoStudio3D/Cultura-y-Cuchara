(function(root){
 'use strict';
 const HOUR=3600000;
 function timestamp(event){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(event?.date||''))return Infinity;
  const time=/^\d{2}:\d{2}$/.test(event.time||'')?event.time:'18:00';
  const value=Date.parse(event.date+'T'+time+':00-05:00');
  return Number.isFinite(value)?value:Infinity;
 }
 function upcoming(events,now=Date.now()){
  return (Array.isArray(events)?events:[]).filter(e=>e&&e.active!==false&&e.hidden!==true&&e.published!==false&&(!e.publicationStatus||e.publicationStatus==='published')&&timestamp(e)!==Infinity&&timestamp(e)+HOUR>now).slice().sort((a,b)=>timestamp(a)-timestamp(b));
 }
 function safeImage(value){if(/^\/?assets\/[a-zA-Z0-9/_-]+\.svg$/.test(String(value||'')))return String(value);try{const u=new URL(String(value||''));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch(_){return '';}}
 function dateLabel(event,lang){return new Intl.DateTimeFormat(lang==='en'?'en-US':'es-EC',{weekday:'short',day:'numeric',month:'short',timeZone:'America/Guayaquil'}).format(new Date(event.date+'T12:00:00-05:00'));}
 function render(events,options={}){
  const host=options.host||root.document?.getElementById('eventsSpotlight');if(!host)return;
  const items=upcoming(events,options.now),en=options.lang==='en';
  host.hidden=!items.length;host.replaceChildren();if(!items.length)return;
  const doc=host.ownerDocument;
  const node=(tag,cls,text)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
  const link=(cls,text,href)=>{const el=node('a',cls,text);el.href=href;return el;};
  const button=(cls,text,action)=>{const el=node('button',cls,text);el.type='button';el.addEventListener('click',action);return el;};
  const shell=node('div','ve-shell'),head=node('header','ve-heading'),heading=node('div');
  heading.append(node('p','ve-eyebrow',en?'WHAT’S ON · LOJA':'CARTELERA · LOJA'));
  const title=node('h2','ve-title',en?'Make a date with Loja.':'Loja tiene un plan para ti.');title.id='eventsSpotlightTitle';
  heading.append(title,node('p','ve-intro',en?'Culture, music and encounters worth going out for.':'Cultura, música y encuentros para salir a vivir Loja.'));
  const all=link('ve-all',en?'See the full agenda ↗':'Ver toda la agenda ↗',options.agendaUrl||'#agenda');
  head.append(heading,all);shell.append(head);
  const layout=node('div','ve-layout');
  function poster(event,featured){
   const media=node('div','ve-poster'+(featured?' ve-poster-featured':''));
   const url=safeImage(event.img);
   const fallback=()=>{media.replaceChildren();media.classList.add('ve-poster-empty');const number=node('strong','',event.date.slice(8));media.append(node('span','',dateLabel(event,options.lang).replace(/\d+/g,'').trim()),number,node('span','',event.type||(en?'In Loja':'En Loja')));};
   if(url){const img=node('img');img.src=url;img.alt=(en?'Poster: ':'Afiche: ')+(event.title||'');img.loading=featured?'eager':'lazy';img.addEventListener('error',fallback,{once:true});media.append(img);}else fallback();
   return media;
  }
  const featured=items[0],feature=node('article','ve-feature');feature.setAttribute('data-vl-surface','dark');
  feature.append(poster(featured,true));const copy=node('div','ve-feature-copy');
  copy.append(node('span','ve-next',en?'UP NEXT':'PRÓXIMO EVENTO'),node('p','ve-date',dateLabel(featured,options.lang)+(featured.time?' · '+featured.time:'')),node('h3','ve-feature-title',en&&featured.titleEn?featured.titleEn:featured.title||'Evento en Loja'),node('p','ve-place','⌖ '+(featured.location||'Loja')));
  const desc=en?(featured.descEn||featured.desc):featured.desc;if(desc)copy.append(node('p','ve-description',desc));
  const actions=node('div','ve-actions');actions.append(button('ve-primary',en?'View event ↗':'Ver evento ↗',()=>options.open?.(featured)));
  if(Number.isFinite(Number(featured.lat))&&Number.isFinite(Number(featured.lng))&&featured.lat!==''&&featured.lng!==''&&featured.lat!=null&&featured.lng!=null)actions.append(button('ve-secondary',en?'Directions':'Cómo llegar',()=>options.map?.(featured)));
  copy.append(actions);feature.append(copy);layout.append(feature);
  if(items.length>1){const aside=node('div','ve-more'),asideTitle=node('h3','ve-more-title',en?'Also coming up':'También en la agenda'),list=node('div','ve-upcoming');list.setAttribute('role','list');
   for(const event of items.slice(1,4)){
    const card=node('article','ve-small');card.setAttribute('role','listitem');card.setAttribute('data-vl-surface','light');card.append(poster(event,false));const body=node('div','ve-small-copy');body.append(node('p','ve-date',dateLabel(event,options.lang)+(event.time?' · '+event.time:'')),node('h4','',en&&event.titleEn?event.titleEn:event.title||'Evento en Loja'),node('p','ve-place',event.location||'Loja'),button('ve-text-button',en?'View details →':'Ver detalles →',()=>options.open?.(event)));card.append(body);list.append(card);
   }
   aside.append(asideTitle,list);layout.append(aside);
  }else layout.classList.add('ve-single');
  shell.append(layout);host.append(shell);
 }
 root.VisitaLojaEventsSpotlight={upcoming,timestamp,safeImage,render};
 if(typeof module==='object'&&module.exports)module.exports=root.VisitaLojaEventsSpotlight;
 if(root.document){const boot=()=>{if(typeof checkLiveEventsBanner==='function')checkLiveEventsBanner();};if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}
})(typeof window==='object'?window:globalThis);
