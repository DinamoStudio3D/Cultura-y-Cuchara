/* Canton directory uses the same assignments configured in Paradas y negocios. */
(function(){
 'use strict';
 const host=document.getElementById('cantones');if(!host)return;
 const catalogue=window.ChabaquitoPlaceConfig?.CANTONS||[],el=id=>document.getElementById(id);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 let selected='';
 function publicPlaces(){return (typeof locations==='undefined'?[]:locations).filter(place=>!place.publicationStatus||place.publicationStatus==='published');}
 function render(){
  const places=publicPlaces(),query=normalize(el('cantonSearch').value),visible=catalogue.filter(canton=>normalize(canton.name).includes(query));
  el('cantonGrid').innerHTML=visible.map(canton=>{const count=places.filter(place=>place.cantonId===canton.id).length;return `<button type="button" class="canton-card" data-canton-id="${esc(canton.id)}" aria-pressed="${selected===canton.id}"><span class="canton-card-icon" aria-hidden="true"><i class="fa-solid fa-map-location-dot"></i></span><strong>${esc(canton.name)}</strong><span>${count} ${count===1?'lugar publicado':'lugares publicados'}</span><small>Explorar cantón <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></small></button>`}).join('');
  el('cantonSearchStatus').textContent=visible.length?visible.length+' cantones para explorar.':'No encontramos un cantón con ese nombre.';
  const canton=catalogue.find(item=>item.id===selected);el('cantonResults').hidden=!canton;if(!canton)return;
  const matches=places.filter(place=>place.cantonId===selected);
  el('cantonResultsTitle').textContent='Lugares de '+canton.name;
  el('cantonResultsCount').textContent=matches.length+' '+(matches.length===1?'lugar publicado':'lugares publicados')+' con este cantón asignado.';
  el('cantonPlaces').innerHTML=matches.length?matches.map(place=>{const href=typeof buildLocationShareUrl==='function'?buildLocationShareUrl(place):'/?lugar='+encodeURIComponent(place.id);return `<article class="canton-place"><span>${esc(place.tag||'Parada Visita Loja')}</span><h4>${esc(place.title||place.id)}</h4><p>${esc(place.desc||place.address||'Consulta la ficha para conocer esta parada.')}</p><a href="${esc(href)}">Abrir ficha del lugar <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></article>`}).join(''):`<p class="canton-empty">Todavía no hay lugares publicados con ${esc(canton.name)} asignado. Puedes explorar los otros cantones; seguiremos incorporando nuevas paradas.</p>`;
 }
 el('cantonSearch').addEventListener('input',render);
 el('cantonGrid').addEventListener('click',event=>{const button=event.target.closest('[data-canton-id]');if(!button||!catalogue.some(canton=>canton.id===button.dataset.cantonId))return;selected=button.dataset.cantonId;render();el('cantonResults').scrollIntoView?.({behavior:'smooth',block:'nearest'});});
 window.renderLojaCantons=render;render();
})();
