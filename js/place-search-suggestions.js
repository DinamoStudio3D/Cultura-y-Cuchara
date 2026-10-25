(function(root){
 'use strict';
 function render(places,options,isOpen,visible,english){
  const host=document.getElementById('placeSearchSuggestions'),model=root.VisitaLojaDiscovery;if(!host||!model)return;
  host.replaceChildren();host.hidden=true;if(visible||!String(options.query||'').trim())return;
  const suggestions=model.suggestions(places,options,isOpen);
  if(suggestions.length){
   const heading=document.createElement('p');heading.textContent=english?'Did you mean one of these places?':'¿Buscabas alguno de estos lugares?';host.append(heading);
   for(const suggestion of suggestions){const button=document.createElement('button');button.type='button';button.textContent=suggestion.title;button.addEventListener('click',()=>root.runSmartSearch(suggestion.query));host.append(button);}
  }
  if(!options.savedOnly){
   const relaxed={...options,category:'all',cantonId:'',openOnly:false};
   const count=places.filter(place=>model.matches(place,relaxed,isOpen)).length;
   if(count){const button=document.createElement('button');button.type='button';button.textContent=english?'Search without the selected filters ('+count+')':'Buscar sin los filtros seleccionados ('+count+')';button.addEventListener('click',()=>{const query=options.query;root.clearAllPlaceFilters();root.runSmartSearch(query);});host.append(button);}
  }
  host.hidden=!host.childNodes.length;
 }
 root.VisitaLojaSearchSuggestions={render};
})(window);
