(function(root){
'use strict';
function logo(value){try{const u=new URL(String(value||''));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function entries(items){const seen=new Set();return (Array.isArray(items)?items:[]).filter(p=>p&&p.id&&p.title&&p.active!==false&&p.hidden!==true&&p.published!==false&&(!p.publicationStatus||p.publicationStatus==='published')&&!seen.has(String(p.id))&&seen.add(String(p.id))).map(p=>({id:String(p.id),name:p.title,image:logo(p.customLogoUrl)}));}
function render(items,options={}){
 const host=options.host||root.document.getElementById('registeredBrands');if(!host)return;
 const list=entries(items);host.hidden=!list.length;host.replaceChildren();if(!list.length)return;
 const doc=host.ownerDocument,en=options.lang==='en',make=(tag,cls,text)=>{const el=doc.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
 const title=make('h2','vr-title',en?'Brands already working with us':'Marcas que ya trabajan con nosotros');title.id='registeredBrandsTitle';
 const viewport=make('div','vr-viewport'),track=make('div','vr-track');
 track.style.setProperty('--vr-duration',Math.max(25,list.length*4)+'s');
 function group(duplicate){const g=make('div','vr-group');if(duplicate){g.setAttribute('aria-hidden','true');g.inert=true;}
 list.forEach(item=>{const b=make('button','vr-brand');b.type='button';b.setAttribute('aria-label',(en?'Discover ':'Conoce ')+item.name);if(duplicate)b.tabIndex=-1;b.addEventListener('click',()=>options.open?.(item.id));if(item.image){const img=make('img','vr-logo');img.src=item.image;img.alt=item.name;img.loading='lazy';img.decoding='async';img.addEventListener('error',()=>{img.remove();b.append(make('span','vr-name',item.name));},{once:true});b.append(img);}else b.append(make('span','vr-name',item.name));g.append(b);});return g;}
 track.append(group(false),group(true));viewport.append(track);host.append(title,viewport);
}
root.VisitaLojaRegisteredBrands={render,entries};
if(typeof locations!=='undefined')render(locations,{lang:typeof currentLang==='undefined'?'es':currentLang,open:id=>{const i=locations.findIndex(p=>String(p.id)===id);if(i>=0)simulateMapClick(i);}});
})(typeof window==='object'?window:globalThis);
