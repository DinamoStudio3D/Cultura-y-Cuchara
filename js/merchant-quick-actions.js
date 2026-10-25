/* Links are scoped only to places already returned for this merchant. */
(function(root){
 'use strict';
 function model(places,selected){
  const place=places.find(item=>item.id===selected)||(places.length===1?places[0]:null);
  const suffix=place?'?placeId='+encodeURIComponent(place.id):'';
  return {place,title:place?String(place.title||place.id):'Selecciona uno de tus negocios',visit:place?'confirmar-visitas.html'+suffix:null,profile:place?'mi-negocio/'+suffix:null,rewards:'merchant-rewards.html'};
 }
 function render(places,selected){
  const state=model(places,selected),heading=document.getElementById('merchantQuickPlace');if(!heading)return;
  heading.textContent=state.title;
  document.getElementById('merchantQuickHint').textContent=state.place?'Las visitas y la edición de ficha se abrirán para esta parada.':'Elige una parada arriba para registrar visitas, consultar sus clientes o editar su ficha.';
  for(const [id,url]of [['merchantQuickVisit',state.visit],['merchantQuickProfile',state.profile]]){
   const link=document.getElementById(id);if(url)link.setAttribute('href',url);else link.removeAttribute('href');link.setAttribute('aria-disabled',String(!url));link.tabIndex=url?0:-1;
  }
  document.getElementById('merchantQuickClients').disabled=!state.place;
 }
 const clients=document.getElementById('merchantQuickClients');
 clients?.addEventListener('click',()=>root.VisitaLojaMerchantWorkspace?.select('clients',true));
 root.VisitaLojaMerchantQuickActions={model,render,requestedPlace(places){const id=new URLSearchParams(root.location?.search||'').get('placeId');return places.some(place=>place.id===id)?id:null;}};
})(window);
