(function(root){
'use strict';
let currentConfig={};
function logo(value){
 const raw=typeof value==='string'?value.trim():'';
 return root.VisitaLojaPodcastMedia?.safeMediaUrl(raw)||'';
}
function entries(items,config){
 return root.VisitaLojaBrandsModel.select(items,config).map(p=>({id:String(p.id),name:p.title,image:logo(p.customLogoUrl),place:p}));
}
function render(items,options={}){
 const host=options.host||root.document.getElementById('registeredBrands');if(!host)return;
 const config=root.VisitaLojaBrandsModel.normalize(options.config||currentConfig);const list=entries(items,config);host.hidden=!config.active||!list.length;host.replaceChildren();if(!list.length||!config.active)return;
 const doc=host.ownerDocument,en=options.lang==='en',make=(tag,cls,text)=>{const el=doc.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
 const title=make('h2','vr-title',en?(config.titleEn||config.title):(config.title||config.titleEn));title.id='registeredBrandsTitle';
 const layout=make('div','vr-layout'),intro=make('div','vr-intro'),viewport=make('div','vr-viewport'),track=make('div','vr-track');
 host.style.setProperty('--vr-count',String(list.length));host.style.setProperty('--vr-card-width',({small:144,medium:180,large:210})[config.size]+'px');
 track.style.setProperty('--vr-duration',config.duration+'s');
 host.dataset.stopped='false';host.dataset.size=config.size;host.dataset.direction=config.direction;host.dataset.motion=String(config.motion);host.dataset.pause=String(config.pauseOnHover);
 function group(duplicate){const g=make('div','vr-group');if(duplicate){g.setAttribute('aria-hidden','true');g.inert=true;}
 for(const item of list){
  const href=config.clickable?options.href?.(item.place):null;
  const card=make(config.clickable?(href?'a':'button'):'div','vr-brand');
  if(href)card.href=href;
  else if(config.clickable){
   card.type='button';
   card.addEventListener('click',()=>options.open?.(item.id));
  }
  if(config.clickable)card.setAttribute('aria-label',(en?'Discover ':'Conoce ')+item.name);
  if(duplicate)card.tabIndex=-1;
  if(item.image){
   const img=make('img','vr-logo');
   img.src=item.image;img.alt=config.showNames?'':item.name;
   img.loading='eager';img.decoding='async';
   img.addEventListener('error',()=>{
    img.remove();
    if(!config.showNames)card.prepend(make('span','vr-name',item.name));
   },{once:true});
   card.append(img);
  }
  if(config.showNames||!item.image)card.append(make('span','vr-name',item.name));
  if(config.clickable)card.append(make('span','vr-cta',en?'Discover the business':'Conocer el negocio'));
  g.append(card);
 }
 return g;
 }
 track.append(group(false));if(config.motion)track.append(group(true));viewport.append(track);if(title.textContent)intro.append(title);const subtitle=en?(config.subtitleEn||config.subtitle):(config.subtitle||config.subtitleEn);if(subtitle)intro.append(make('p','vr-subtitle',subtitle));
 if(config.includeMesa){
  const mesa=make('a','vr-institution',en?'Loja Tourism Board':'Mesa Turística de Loja');
  mesa.href='/mesa-turistica.html';
  intro.append(mesa);
 }
 layout.append(intro,viewport);host.append(layout);
 if(config.motion){const pause=make('button','vr-pause',en?'Pause movement':'Pausar movimiento');pause.type='button';pause.setAttribute('aria-pressed','false');pause.addEventListener('click',()=>{const stopped=host.dataset.stopped!=='true';host.dataset.stopped=String(stopped);pause.setAttribute('aria-pressed',String(stopped));pause.textContent=stopped?(en?'Resume movement':'Reanudar movimiento'):(en?'Pause movement':'Pausar movimiento');});layout.append(pause);}
}
let unsubscribe=null;
function refresh(){if(typeof locations!=='undefined')render(locations,{lang:typeof currentLang==='undefined'?'es':currentLang,href:place=>typeof buildLocationShareUrl==='function'?buildLocationShareUrl(place):null,open:id=>{const i=locations.findIndex(p=>String(p.id)===id);if(i>=0)simulateMapClick(i);}});}
function connect(database){if(unsubscribe)return;unsubscribe=database.collection('siteContent').doc('registeredBrands').onSnapshot(s=>{currentConfig=root.VisitaLojaBrandsModel.normalize(s.exists?s.data():{});refresh();},()=>{refresh();});}
root.VisitaLojaRegisteredBrands={render,entries,connect};
if(typeof locations!=='undefined'){refresh();if(typeof db!=='undefined'&&db)connect(db);root.setInterval(refresh,60000);}
})(typeof window==='object'?window:globalThis);
