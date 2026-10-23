/* Administrative visibility: drafts stay manageable without becoming public. */
(function(root){
 'use strict';
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const status=place=>['draft','hidden'].includes(normalize(place?.publicationStatus))?normalize(place.publicationStatus):'published';
 function matches(place,{publication='all',category='all',search=''}={},categoryLabel=()=> ''){
  const query=normalize(search);return(publication==='all'||status(place)===publication)&&(category==='all'||place.category===category)&&(!query||[place.title,place.titleEn,place.tag,place.category,categoryLabel(place.category),place.address].some(value=>normalize(value).includes(query)));
 }
 function filtersAfterSave(place,filters,categoryLabel){return matches(place,filters,categoryLabel)?{...filters}:{publication:status(place),category:'all',search:'',sort:'newest'};}
 const api={status,matches,filtersAfterSave};if(typeof module==='object'&&module.exports)module.exports=api;else root.VisitaLojaAdminPlaceDirectory=api;
})(typeof window==='object'?window:globalThis);
