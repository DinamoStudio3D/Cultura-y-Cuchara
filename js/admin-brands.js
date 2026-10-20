(function(root){'use strict';
const model=root.VisitaLojaBrandsModel,form=document.getElementById('brandsConfigForm');if(!form||!model)return;
const el=id=>document.getElementById(id),fields={active:'brandsActive',title:'brandsTitle',titleEn:'brandsTitleEn',subtitle:'brandsSubtitle',subtitleEn:'brandsSubtitleEn',mode:'brandsMode',size:'brandsSize',duration:'brandsDuration',direction:'brandsDirection',motion:'brandsMotion',pauseOnHover:'brandsPause',showNames:'brandsShowNames',clickable:'brandsClickable'};
let places=[],draft=model.normalize(),saved=model.normalize(),revision=0,dirty=false,ready=false,placesReady=false,ref=null,unsubscribe=null,saving=false;
const status=text=>{el('brandsStatus').textContent=text;};
function mark(value){dirty=value;if(typeof setAdminUnsavedChanges==='function')setAdminUnsavedChanges(value);}
function read(){for(const[k,id]of Object.entries(fields)){const f=el(id);draft[k]=f.type==='checkbox'?f.checked:f.value;}draft=model.normalize(draft);}
function fill(){for(const[k,id]of Object.entries(fields)){const f=el(id);if(f.type==='checkbox')f.checked=draft[k];else f.value=draft[k];}rows();preview();}
function preview(){root.VisitaLojaRegisteredBrands.render(places,{host:el('registeredBrands'),config:draft,open:id=>{if(typeof editAdminPlace==='function'){if(showAdminModule('places')!==false)editAdminPlace(id);}}});el('brandsPreviewEmpty').hidden=!el('registeredBrands').hidden;}
function ordered(){const rank=new Map(draft.orderIds.map((id,i)=>[id,i]));return places.filter(p=>model.eligible(p)).map((p,i)=>({p,i})).sort((a,b)=>(rank.get(String(a.p.id))??100000+a.i)-(rank.get(String(b.p.id))??100000+b.i)).map(x=>x.p);}
function selected(id){return draft.mode==='all'?!draft.excludedIds.includes(id):draft.selectedIds.includes(id);}
function choose(id,on){if(draft.mode==='all')draft.excludedIds=on?draft.excludedIds.filter(x=>x!==id):[...new Set([...draft.excludedIds,id])];else draft.selectedIds=on?[...new Set([...draft.selectedIds,id])]:draft.selectedIds.filter(x=>x!==id);}
function button(text,label,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.addEventListener('click',action);return b;}
function rows(){const list=el('brandsPlaceList');list.replaceChildren();const items=ordered(),q=el('brandsSearch').value.toLocaleLowerCase('es').trim();const showing=items.filter(p=>String(p.title).toLocaleLowerCase('es').includes(q));
 showing.forEach(p=>{const id=String(p.id),row=document.createElement('div');row.className='brands-admin-row';const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=selected(id);check.addEventListener('change',()=>{choose(id,check.checked);mark(true);preview();counts();});const image=root.VisitaLojaPodcastMedia.safeMediaUrl(p.customLogoUrl||'');if(image){const img=document.createElement('img');img.src=image;img.alt='';img.addEventListener('error',()=>img.remove(),{once:true});label.append(img);}label.prepend(check);label.append(document.createTextNode(p.title));row.append(label);
 const index=items.indexOf(p),move=delta=>{const ids=items.map(x=>String(x.id));[ids[index],ids[index+delta]]=[ids[index+delta],ids[index]];draft.orderIds=ids;mark(true);rows();preview();};
 const up=button('↑','Subir '+p.title,()=>move(-1)),down=button('↓','Bajar '+p.title,()=>move(1));up.disabled=index===0;down.disabled=index===items.length-1;
 row.append(up,down,button('Editar logo','Editar ficha de '+p.title,()=>{if(showAdminModule('places')!==false)editAdminPlace(id);}));list.append(row);});
 if(!showing.length){const text=document.createElement('p');text.textContent=placesReady?'No hay paradas con un plan de pago vigente que coincidan.':'Cargando paradas…';list.append(text);}counts();
}
function counts(){el('brandsCount').textContent=model.select(places,draft).length+' de '+places.filter(p=>model.eligible(p)).length+' paradas con plan vigente seleccionadas';}
function available(){el('brandsSave').disabled=!ready||!placesReady||saving;}
function setPlaces(value){places=Array.isArray(value)?value:[];placesReady=true;rows();preview();available();}
function discard(){draft=model.normalize(saved);mark(false);fill();}
function stop(){unsubscribe?.();unsubscribe=null;ref=null;ready=false;placesReady=false;places=[];revision=0;mark(false);available();}
function start(database){stop();ref=database.collection('siteContent').doc('registeredBrands');status('Cargando configuración…');unsubscribe=ref.onSnapshot(s=>{const data=s.exists?s.data():{};saved=model.normalize(data);ready=true;if(!dirty){revision=Number(data.revision)||0;}if(!dirty){draft=model.normalize(saved);fill();status('Configuración cargada. Puedes probar cambios antes de guardar.');}else if(!saving)status('La configuración guardada cambió. Recarga antes de guardar para revisar la última versión.');available();},()=>{ready=false;available();status('No se pudo cargar la configuración. Usa recargar para intentarlo de nuevo.');});}
for(const id of Object.values(fields))el(id).addEventListener('input',()=>{read();mark(true);rows();preview();});
el('brandsSearch').addEventListener('input',rows);
el('brandsSelectAll').addEventListener('click',()=>{ordered().forEach(p=>choose(String(p.id),true));mark(true);rows();preview();});
el('brandsSelectNone').addEventListener('click',()=>{ordered().forEach(p=>choose(String(p.id),false));mark(true);rows();preview();});
el('brandsDefaults').addEventListener('click',()=>{draft=model.normalize();mark(true);fill();status('Opciones restablecidas en la vista previa. Guarda para aplicarlas.');});
el('brandsReload').addEventListener('click',async()=>{if(dirty&&!confirm('¿Descartar los cambios sin guardar?'))return;if(!ref)return;try{const s=await ref.get({source:'server'}),data=s.exists?s.data():{};saved=model.normalize(data);revision=Number(data.revision)||0;ready=true;discard();available();status('Configuración recargada.');}catch{status('No se pudo recargar. Conservamos tus cambios.');}});
form.addEventListener('submit',async event=>{event.preventDefault();if(!ready||!placesReady||saving||!ref)return;read();if(!draft.title){status('Escribe el título en español.');el('brandsTitle').focus();return;}const expected=revision,data=model.normalize(draft),database=ref.firestore;
 saving=true;available();status('Guardando…');
 try{await database.runTransaction(async tx=>{const current=await tx.get(ref);if((Number(current.data()?.revision)||0)!==expected)throw new Error('conflict');tx.set(ref,{...data,revision:expected+1,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:auth.currentUser.email||auth.currentUser.uid});});saved=data;revision=expected+1;mark(false);status('Configuración guardada. La franja de la web se actualiza automáticamente.');if(typeof recordAdminAudit==='function')recordAdminAudit('brands.configure','registeredBrands','Configuración del carrusel de paradas').catch(()=>{});}
 catch(error){status(error.message==='conflict'?'Otro administrador cambió la configuración. Recarga para revisar antes de guardar.':error.code==='permission-denied'?'No tienes permiso para guardar esta configuración.':'No se pudo guardar. Tus cambios siguen en la vista previa.');}
 finally{saving=false;available();}
});
root.VisitaLojaBrandsAdmin={start,stop,setPlaces,discard};
})(typeof window==='object'?window:globalThis);