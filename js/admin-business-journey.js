/* Navigation only: all edits and permissions stay in the existing forms. */
(function(root){
 'use strict';
 const select=document.getElementById('adminJourneyPlace');if(!select)return;
 const summary=document.getElementById('adminJourneySummary'),notice=document.getElementById('adminSelectedPlaceNotice'),context=document.getElementById('adminJourneyContextText');
 const buttons=[...document.querySelectorAll('[data-journey-action]')];
 let places=[],selected=null,moduleName='dashboard';
 function render(){
  select.value=selected?.id||'';
  buttons.forEach(button=>button.disabled=!selected);
  const state=selected?.publicationStatus||'published',labels={published:'Publicada',draft:'Borrador',hidden:'Oculta'};
  summary.textContent=selected?selected.title+' · '+(labels[state]||'Estado por revisar')+'. Cada paso se guarda en su propio formulario.':'Selecciona una parada o crea una nueva para comenzar.';
  context.textContent=selected?'Estás preparando: '+selected.title:'';
  notice.hidden=!selected||!['places','merchants','fidelity','subscriptions'].includes(moduleName);
 }
 function choose(place){
  if(!place?.id)return false;
  selected={...place,title:String(place.title||place.id)};
  if(!places.some(item=>item.id===place.id)){places.push(selected);options();}
  render();return true;
 }
 function options(){
  select.replaceChildren(new Option('Selecciona una parada',''));
  [...places].sort((a,b)=>String(a.title||a.id).localeCompare(String(b.title||b.id),'es')).forEach(place=>select.add(new Option(String(place.title||place.id),place.id)));
 }
 function update(items){
  places=items.filter(item=>item?.id);
  if(selected){const saved=places.find(item=>item.id===selected.id);selected=saved?{...saved,title:String(saved.title||saved.id)}:null;}
  options();render();
 }
 function permitEditor(){
  if(typeof adminUnsavedChanges!=='undefined'&&adminUnsavedChanges){
   if(!root.confirm('Tienes cambios sin guardar. ¿Quieres descartarlos para abrir esta ficha?'))return false;
   setAdminUnsavedChanges(false);
  }
  return showAdminModule('places')!==false;
 }
 function edit(publication=false){
  if(!selected||!permitEditor())return false;
  const id=selected.id;
  Promise.resolve(editAdminPlace(id)).then(()=>{
   if(publication&&selected?.id===id){const field=document.getElementById('placePublicationStatus');field?.focus();field?.scrollIntoView({block:'center',behavior:'auto'});}
  });return true;
 }
 select.addEventListener('change',()=>{const place=places.find(item=>item.id===select.value);selected=null;if(place)choose(place);else render();});
 buttons.forEach(button=>button.addEventListener('click',()=>{
  if(!selected)return;
  const action=button.dataset.journeyAction;
  if(action==='edit'||action==='publish')edit(action==='publish');
  else if(action==='owner')openPlaceManagement(selected.id,'merchants');
  else if(action==='benefits')openPlaceManagement(selected.id,'fidelity');
 }));
 document.getElementById('adminJourneyNew').addEventListener('click',()=>{if(permitEditor()){selected=null;render();resetPlaceForm();}});
 document.getElementById('adminJourneyBack').addEventListener('click',()=>{if(showAdminModule('places')===false)return;document.getElementById('adminJourneyTitle').scrollIntoView({block:'start',behavior:'auto'});select.focus();});
 root.VisitaLojaAdminBusinessJourney={update,select:choose,clear(){selected=null;render();},moduleChanged(name){moduleName=name;render();}};
 render();
})(window);
