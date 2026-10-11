(function(){
 'use strict';
 const search=document.getElementById('loyaltyCardSearch'),filter=document.getElementById('loyaltyCardFilter'),results=document.getElementById('loyaltyCardResults');
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const clear=document.createElement('button');clear.type='button';clear.id='loyaltyClearCardFilters';clear.hidden=true;
 if(results)results.after(clear);
 function applyFilter(){
  const cards=window.visitaLojaWalletCards||[],nodes=[...document.querySelectorAll('#walletList .loyalty-pass')],q=normalize(search?.value).trim(),en=document.documentElement.lang==='en';let count=0;
  for(const node of nodes){const card=cards.find(c=>c.placeId===node.dataset.placeId),visited=Number(card?.total||0)>0,visible=(!q||normalize(card?.placeName).includes(q))&&(filter?.value==='visited'?visited:filter?.value==='new'?!visited:true);node.hidden=!visible;if(visible)count++;}
  if(results)results.textContent=!nodes.length?'':count?(en?`${count} of ${nodes.length} cards`:`${count} de ${nodes.length} tarjetas`):(en?'No cards match. Try another business name or clear the filters.':'No hay tarjetas con estos filtros. Prueba otro nombre o limpia los filtros.');
  clear.hidden=!nodes.length||count>0;clear.textContent=en?'Clear filters':'Limpiar filtros';
 }
 clear.addEventListener('click',()=>{if(search)search.value='';if(filter)filter.value='all';applyFilter();search?.focus();});
 search?.addEventListener('input',applyFilter);filter?.addEventListener('change',applyFilter);window.addEventListener('visitaloja:wallet-rendered',applyFilter);window.addEventListener('visitaloja:loyalty-language',applyFilter);
})();
