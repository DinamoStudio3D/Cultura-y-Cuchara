(function(root){
'use strict';
const states=new WeakMap();
function render(events,options={}){
 const host=options.host||root.document?.getElementById('eventsBillboard'),api=root.VisitaLojaEventsSpotlight;
 if(!host||!api)return;
 let previous=states.get(host);if(previous?.timer)root.clearInterval(previous.timer);
 const items=api.upcoming(events,options.now).slice(0,15),en=options.lang==='en',doc=host.ownerDocument;
 host.hidden=!items.length;host.replaceChildren();if(!items.length){states.delete(host);return;}
 const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
 const selected=previous?.id?items.findIndex(e=>e.id===previous.id):-1;
 const state={index:Math.max(0,selected),playing:previous?previous.playing:!reduced,id:null,hovered:false,timer:null};states.set(host,state);
 const node=(tag,cls,text)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
 const button=(cls,label,action)=>{const el=node('button',cls,label);el.type='button';el.addEventListener('click',action);return el;};
 const shell=node('div','vb-shell'),heading=node('header','vb-heading'),intro=node('div','vb-heading-copy');
 const title=node('h2','vb-title',en?'Coming up in Loja':'La cartelera de Loja');title.id='eventsBillboardTitle';intro.append(node('span','vb-eyebrow',en?'GO OUT · DISCOVER · ENJOY':'SAL · DESCUBRE · DISFRUTA'),title);
 const all=node('a','vb-all',en?'All events ↗':'Todos los eventos ↗');all.href='#agenda';heading.append(intro,all);
 const stage=node('div','vb-stage');stage.setAttribute('aria-live','off');stage.setAttribute('aria-atomic','true');
 const footer=node('div','vb-footer'),controls=node('div','vb-controls'),dots=node('div','vb-dots'),counter=node('span','vb-counter');
 const go=index=>{state.index=(index+items.length)%items.length;state.playing=false;show(true);};
 const prev=button('vb-arrow','←',()=>go(state.index-1));prev.setAttribute('aria-label',en?'Previous event':'Evento anterior');
 const next=button('vb-arrow','→',()=>go(state.index+1));next.setAttribute('aria-label',en?'Next event':'Evento siguiente');
 const pause=button('vb-pause','',()=>{state.playing=!state.playing;updateControl();});
 function updateControl(){pause.textContent=state.playing?(en?'Pause':'Pausar'):(en?'Play':'Reproducir');pause.setAttribute('aria-label',state.playing?(en?'Pause event rotation':'Pausar rotación de eventos'):(en?'Start event rotation':'Iniciar rotación de eventos'));pause.setAttribute('aria-pressed',String(!state.playing));}
 items.forEach((event,index)=>{const dot=button('vb-dot','',()=>go(index));dot.setAttribute('aria-label',(en?'Show event ':'Mostrar evento ')+(index+1)+': '+(event.title||''));dots.append(dot);});
 function show(manual=false){
  const event=items[state.index];state.id=event.id;stage.setAttribute('aria-live',manual?'polite':'off');stage.replaceChildren();
  const card=node('article','vb-slide');card.setAttribute('data-vl-surface','light');
  const media=node('div','vb-poster'),banner=api.safeImage(event.bannerImg),image=banner||api.safeImage(event.img);if(banner)card.classList.add('vb-has-banner');
  const placeholder=()=>{media.replaceChildren();media.classList.add('vb-calendar');media.append(node('span','',en?'IN LOJA':'EN LOJA'),node('strong','',event.date.slice(8)),node('span','',event.type||'Evento'));};
  if(image){const img=node('img');img.src=image;img.alt=(en?'Poster: ':'Afiche: ')+(event.title||'');img.addEventListener('error',placeholder,{once:true});media.append(img);}else placeholder();
  const body=node('div','vb-copy'),date=new Intl.DateTimeFormat(en?'en-US':'es-EC',{weekday:'short',day:'numeric',month:'short',timeZone:'America/Guayaquil'}).format(new Date(event.date+'T12:00:00-05:00'));
  body.append(node('p','vb-date',date+(event.time?' · '+event.time:'')),node('h3','vb-event-title',en&&event.titleEn?event.titleEn:event.title||'Evento en Loja'),node('p','vb-location','⌖ '+(event.location||'Loja')));
  const actions=node('div','vb-actions');actions.append(button('vb-detail',en?'View event ↗':'Ver evento ↗',()=>options.open?.(event)));
  if(event.lat!=null&&event.lng!=null&&event.lat!==''&&event.lng!==''&&Number.isFinite(Number(event.lat))&&Number.isFinite(Number(event.lng)))actions.append(button('vb-map',en?'Map':'Ver en el mapa',()=>options.map?.(event)));
  body.append(actions);card.append(media,body);stage.append(card);
  [...dots.children].forEach((dot,index)=>dot.setAttribute('aria-current',index===state.index?'true':'false'));
  counter.textContent=String(state.index+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0');updateControl();
 }
 if(items.length>1){controls.append(prev,counter,next,pause);footer.append(dots,controls);}else footer.hidden=true;
 shell.append(heading,stage,footer);host.append(shell);host.setAttribute('aria-roledescription',en?'carousel':'carrusel');show();
 host.onmouseenter=()=>{state.hovered=true;};host.onmouseleave=()=>{state.hovered=false;};
 host.onkeydown=event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();go(state.index+(event.key==='ArrowRight'?1:-1));}};
 let touchX=null;host.onpointerdown=event=>{touchX=event.pointerType==='touch'?event.clientX:null;};host.onpointerup=event=>{if(touchX!=null&&Math.abs(event.clientX-touchX)>50)go(state.index+(event.clientX<touchX?1:-1));touchX=null;};
 if(items.length>1)state.timer=root.setInterval(()=>{if(state.playing&&!state.hovered&&!doc.hidden&&!host.contains(doc.activeElement)){state.index=(state.index+1)%items.length;show();}},6500);
}
root.VisitaLojaEventsBillboard={render};
if(root.document&&typeof checkLiveEventsBanner==='function')checkLiveEventsBanner();
})(typeof window==='object'?window:globalThis);