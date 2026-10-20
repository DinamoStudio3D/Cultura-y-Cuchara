(function(root){
'use strict';
let currentConfig={};
function logo(value){
 const raw=typeof value==='string'?value.trim():'';
 return root.VisitaLojaPodcastMedia?.safeMediaUrl(raw)||'';
}
function entries(items,config){items=root.VisitaLojaBrandsModel.select(items,config);const seen=new Set();const list=(Array.isArray(items)?items:[]).filter(p=>p&&p.id&&p.title&&p.active!==false&&p.hidden!==true&&p.published!==false&&(!p.publicationStatus||p.publicationStatus==='published')&&!seen.has(String(p.id))&&seen.add(String(p.id))).map(p=>({id:String(p.id),name:p.title,image:logo(p.customLogoUrl)}));if(root.VisitaLojaBrandsModel.normalize(config).includeMesa)list.push({id:'institution-mesa-turistica',name:'Mesa Turística de Loja',image:'logo%20mesa%20turistica.webp',href:'/mesa-turistica.html'});return list;}
function render(items,options={}){
 const host=options.host||root.document.getElementById('registeredBrands');if(!host)return;
 const config=root.VisitaLojaBrandsModel.normalize(options.config||currentConfig);const list=entries(items,config);host.hidden=!config.active||!list.length;host.replaceChildren();if(!list.length||!config.active)return;
 const doc=host.ownerDocument,en=options.lang==='en',make=(tag,cls,text)=>{const el=doc.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
 const title=make('h2','vr-title',en?(config.titleEn||config.title):(config.title||config.titleEn));title.id='registeredBrandsTitle';
 const viewport=make('div','vr-viewport'),track=make('div','vr-track');
 track.style.setProperty('--vr-duration',config.duration+'s');
 host.dataset.stopped='false';host.dataset.size=config.size;host.dataset.direction=config.direction;host.dataset.motion=String(config.motion);host.dataset.pause=String(config.pauseOnHover);
 function group(duplicate){const g=make('div','vr-group');if(duplicate){g.setAttribute('aria-hidden','true');g.inert=true;}
 list.forEach(item=>{const b=make(config.clickable?(item.href?'a':'button'):'div','vr-brand');if(config.clickable){if(item.href)b.href=item.href;else b.type='button';}if(item.id==='institution-mesa-turistica')b.setAttribute('data-institution','mesa');b.setAttribute('aria-label',(en?'Discover ':'Conoce ')+item.name);if(duplicate)b.tabIndex=-1;if(config.clickable&&!item.href)b.addEventListener('click',()=>options.open?.(item.id));if(item.image){const img=make('img','vr-logo');img.src=item.image;img.alt=item.name;img.loading='eager';img.decoding='async';img.addEventListener('error',()=>{img.remove();if(!config.showNames)b.append(make('span','vr-name',item.name));},{once:true});b.append(img);if(config.showNames)b.append(make('span','vr-name',item.name));}else b.append(make('span','vr-name',item.name));g.append(b);});return g;}
 track.append(group(false));if(config.motion)track.append(group(true));viewport.append(track);if(title.textContent)host.append(title);const subtitle=en?(config.subtitleEn||config.subtitle):(config.subtitle||config.subtitleEn);if(subtitle)host.append(make('p','vr-subtitle',subtitle));host.append(viewport);
 if(config.motion){const pause=make('button','vr-pause',en?'Pause movement':'Pausar movimiento');pause.type='button';pause.setAttribute('aria-pressed','false');pause.addEventListener('click',()=>{const stopped=host.dataset.stopped!=='true';host.dataset.stopped=String(stopped);pause.setAttribute('aria-pressed',String(stopped));pause.textContent=stopped?(en?'Resume movement':'Reanudar movimiento'):(en?'Pause movement':'Pausar movimiento');});host.append(pause);}
}
let unsubscribe=null;
function refresh(){if(typeof locations!=='undefined')render(locations,{lang:typeof currentLang==='undefined'?'es':currentLang,open:id=>{const i=locations.findIndex(p=>String(p.id)===id);if(i>=0)simulateMapClick(i);}});}
function connect(database){if(unsubscribe)return;unsubscribe=database.collection('siteContent').doc('registeredBrands').onSnapshot(s=>{currentConfig=root.VisitaLojaBrandsModel.normalize(s.exists?s.data():{});refresh();},()=>{refresh();});}
root.VisitaLojaRegisteredBrands={render,entries,connect};
if(typeof locations!=='undefined'){refresh();if(typeof db!=='undefined'&&db)connect(db);root.setInterval(refresh,60000);}
})(typeof window==='object'?window:globalThis);
