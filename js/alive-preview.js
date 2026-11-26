/* Small enhancements only; nothing stays hidden if this script is unavailable. */
(() => {
 'use strict';
 function previewCopy(){
  const en=document.getElementById('langSelector')?.value==='en';
  const title=document.getElementById('heroTitle'),sub=document.getElementById('heroSubtitle'),badge=document.getElementById('heroBadge');
  const mobile=matchMedia('(max-width:767px)').matches;
  const heading=mobile?(en?'Loja is <em class="vl-editorial-accent">waiting for you.</em>':'Loja <em class="vl-editorial-accent">se vive.</em>'):en?'Step outside. <em class="vl-editorial-accent">Discover Loja.</em>':'Hoy se sale <em class="vl-editorial-accent">a descubrir Loja.</em>';
  const description=en?'Local flavours, unexpected corners and a new favourite place. Where shall we start?':'Sabores de aquí, rincones por conocer y tu próximo lugar favorito. ¿Por dónde empezamos?';
  const eyebrow=en?'LOJA, ECUADOR · AT YOUR OWN PACE':'LOJA, ECUADOR · A TU RITMO';
  if(title&&title.innerHTML!==heading)title.innerHTML=heading;
  if(sub&&sub.textContent!==description)sub.textContent=description;
  if(badge&&badge.textContent!==eyebrow)badge.textContent=eyebrow;
 }
 previewCopy();
 window.addEventListener('languagechange',previewCopy);
 matchMedia('(max-width:767px)').addEventListener('change',previewCopy);
 const copyRoot=document.querySelector('#inicio .vl-welcome-copy');
 if(copyRoot)new MutationObserver(previewCopy).observe(copyRoot,{childList:true,subtree:true,characterData:true});
 function placePhotoControls(){
  const controls=document.querySelector('#inicio .vl-photo-carousel-ui');
  const frame=document.getElementById('mobilePhotoFrame');
  const shell=document.querySelector('#inicio .vl-welcome-shell');
  const host=matchMedia('(max-width:760px)').matches&&frame?frame:shell;
  if(controls&&host&&controls.parentElement!==host)host.append(controls);
 }
 placePhotoControls();
 const photoMedia=matchMedia('(max-width:760px)');
 photoMedia.addEventListener('change',placePhotoControls);
 const hero=document.getElementById('inicio');
 if(hero)new MutationObserver(placePhotoControls).observe(hero,{childList:true,subtree:true});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const root=document.documentElement;
 if(reduced.matches||root.classList.contains('low-data-mode')||!('IntersectionObserver' in window))return;
 const seen=new WeakSet();
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){
   if(!reduced.matches&&!root.classList.contains('low-data-mode'))entry.target.classList.add('vl-alive-enter');
   observer.unobserve(entry.target);
  }
 },{threshold:.12});
 function observe(){
  for(const element of document.querySelectorAll('.vl-mobile-intents>a,.vl-mobile-stories>a,#localesGrid>.local-item:nth-child(-n+9)'))if(!seen.has(element)){seen.add(element);observer.observe(element);}
 }
 observe();
 const main=document.getElementById('main-content');
 if(main)new MutationObserver(observe).observe(main,{childList:true,subtree:true});
})();

/* A bounded home selection from the existing published catalogue and agenda. */
(() => {
 'use strict';
 let events=[];
 const mobile=matchMedia('(max-width:767px)');
 const en=()=>document.getElementById('langSelector')?.value==='en';
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
 function group(id,title,href,label){
  const section=node('section',null,'vl-home-feed');section.id=id;
  const header=node('header');const heading=node('h2',title);heading.id=id+'Title';section.setAttribute('aria-labelledby',heading.id);
  const link=node('a',label);link.href=href;header.append(heading,link);section.append(header);return section;
 }
 function render(){
  const hub=document.getElementById('mobileExploreHub');if(!hub)return;
  document.getElementById('homePlacesSelection')?.remove();document.getElementById('homeAgendaSelection')?.remove();
  const more=hub.querySelector('details');
  if(more&&!more.classList.contains('vl-home-more')){
   more.classList.add('vl-home-more');
   for(const item of hub.querySelectorAll(':scope > .vl-mobile-stories,:scope > .vl-mobile-passport-link,:scope > .vl-mobile-secondary-links'))more.insertBefore(item,more.querySelector('.vl-mobile-more'));
  }
  if(more)more.querySelector('summary').firstChild.textContent=en()?'More of VisitaLoja ':'Más de VisitaLoja ';
  let shortcuts=hub.querySelector('.vl-home-shortcuts');
  if(!shortcuts){shortcuts=node('nav',null,'vl-home-shortcuts');shortcuts.setAttribute('aria-label','Más experiencias');hub.querySelector('.vl-mobile-business')?.before(shortcuts);}
  for(const [href,es,english,icon] of [['#loja-en-imagenes','Fotos','Photos','fa-camera'],['#loja-en-video','Videos','Videos','fa-circle-play'],['#pasaporte','Pasaporte','Passport','fa-stamp'],['#misiones','Misiones','Missions','fa-compass']]){
   const link=hub.querySelector('a[href="'+href+'"]');if(!link)continue;
   link.className='';link.replaceChildren();const symbol=node('i',null,'fa-solid '+icon);symbol.setAttribute('aria-hidden','true');link.append(symbol,node('span',en()?english:es));shortcuts.append(link);
  }
  const hubTitle=document.getElementById('mobileExploreTitle');if(hubTitle)hubTitle.textContent=en()?'What shall we do today?':'¿Qué hacemos hoy?';
  const all=[...document.querySelectorAll('#localesGrid .local-item:not(.aliado)')];
  const picked=[],categories=new Set();
  for(const card of all){const category=card.querySelector('.vl17-media .absolute span')?.textContent.trim()||'';if(!categories.has(category)){picked.push(card);categories.add(category);}if(picked.length===3)break;}
  for(const card of all)if(picked.length<3&&!picked.includes(card))picked.push(card);
  if(picked.length){
   const section=group('homePlacesSelection',en()?'Discover Loja':'Descubre Loja','#establecimientos',en()?'All stops':'Ver paradas');
   const list=node('div',null,'vl-home-places');
   const shown=picked;
   for(const source of shown){
    const target=source.querySelector('.discovery-card-links a');const photo=source.querySelector('.vl17-media img');if(!target||!photo)continue;
    const url=new URL(target.href,location.href);if(url.origin!==location.origin)continue;
    const title=source.querySelector('.local-title')?.textContent.trim()||'';
    const card=node('a',null,'vl-home-place');card.href=url.href;
    const image=node('img');image.src=photo.currentSrc||photo.src;image.alt=title;image.loading='lazy';image.decoding='async';image.addEventListener('error',()=>{image.src='assets/photos/photo-unavailable.svg';},{once:true});
    const copy=node('div');copy.append(node('small',source.querySelector('.vl17-media .absolute span')?.textContent.trim()),node('h3',title));
    if(!mobile.matches)copy.append(node('span',en()?'Discover this place':'Conocer el lugar'));
    card.append(image,copy);list.append(card);
   }
   section.append(list);
   hub.querySelector('.vl-mobile-intents')?.after(section);
  }
  const upcoming=window.VisitaLojaEventsSpotlight?.upcoming(events,Date.now())||events.filter(e=>{const stamp=Date.parse(e.date+'T'+(/^\d{2}:\d{2}$/.test(e.time||'')?e.time:'18:00')+':00-05:00');return Number.isFinite(stamp)&&stamp+3600000>Date.now();});
  const unique=new Map();for(const event of upcoming){const key=[event.date,event.time,event.title,event.location||event.place].join('|');if(!unique.has(key))unique.set(key,event);}
  const selected=[...unique.values()].sort((a,b)=>(a.date+(a.time||'18:00')).localeCompare(b.date+(b.time||'18:00'))).slice(0,mobile.matches?1:2);
  const agendaLink=hub.querySelector('.vl-mobile-secondary-links a[href="#agenda"]');
  if(agendaLink)agendaLink.hidden=selected.length>0;
  if(selected.length){
   const section=group('homeAgendaSelection',en()?'Coming up in Loja':'Lo próximo en Loja','#agenda',en()?'View agenda':'Ver agenda');
   const list=node('div',null,'vl-home-events');
   for(const event of selected){const link=node('a');link.href='#agenda';const date=new Date(event.date+'T12:00:00-05:00');link.append(node('small',date.toLocaleDateString(en()?'en':'es-EC',{day:'numeric',month:'short'})+(event.time?' · '+event.time:'')),node('h3',en()&&event.titleEn?event.titleEn:event.title),node('span',event.location||event.place||'Loja'));list.append(link);}
   section.append(list);(document.getElementById('homePlacesSelection')||hub.querySelector('.vl-mobile-intents'))?.after(section);
  }
 }
 window.addEventListener('visitaloja:home-events',event=>{events=event.detail||[];render();});
 window.addEventListener('visitaloja:places-rendered',render);
 mobile.addEventListener('change',render);
 window.addEventListener('languagechange',()=>requestAnimationFrame(render));
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
 setInterval(()=>{if(!document.hidden)render();},60000);
})();
