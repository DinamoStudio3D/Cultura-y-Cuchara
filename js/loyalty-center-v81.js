(function(){
 'use strict';
 const search=document.getElementById('loyaltyCardSearch'),filter=document.getElementById('loyaltyCardFilter'),results=document.getElementById('loyaltyCardResults');
 function applyFilter(){const cards=window.visitaLojaWalletCards||[],nodes=[...document.querySelectorAll('#walletList .loyalty-pass')],q=(search?.value||'').trim().toLocaleLowerCase('es');let count=0;for(const node of nodes){const card=cards.find(c=>c.placeId===node.dataset.placeId),visited=Number(card?.total||0)>0,visible=(!q||String(card?.placeName||'').toLocaleLowerCase('es').includes(q))&&(filter?.value==='visited'?visited:filter?.value==='new'?!visited:true);node.hidden=!visible;if(visible)count++;}if(results)results.textContent=nodes.length?`${count} de ${nodes.length} tarjetas`:'';}
 search?.addEventListener('input',applyFilter);filter?.addEventListener('change',applyFilter);window.addEventListener('visitaloja:wallet-rendered',applyFilter);
})();
