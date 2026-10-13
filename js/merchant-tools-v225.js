/* Move the existing preview intact; its listeners and fields stay attached. */
(function(){
 'use strict';
 const simulation=document.getElementById('lpSim')?.closest('article');
 if(!simulation)return;
 const grid=simulation.parentElement;
 const details=document.createElement('details');details.className='merchant-draft-tools merchant-points-example';
 const summary=document.createElement('summary');summary.textContent='Probar una tarjeta de ejemplo · sin puntos reales';
 const note=document.createElement('p');note.className='merchant-example-note';note.textContent='Esta simulación usa un saldo de ejemplo. No modifica el saldo de ningún cliente ni crea un canje o premio.';
 grid.before(details);details.append(summary,note,simulation);grid.classList.add('merchant-points-live');
})();
