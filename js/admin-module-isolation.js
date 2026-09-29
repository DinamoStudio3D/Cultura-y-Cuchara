(function(){
'use strict';
const CORE={places:'placesModule',businessAccess:'businessAccessModule'};
const AUXILIARY_SELECTOR='[id$="Module"], [data-admin-module], [data-module], #chabaquitoMissionsV2Preview, [data-preview-only="true"]';
function dynamicModules(){return [...document.querySelectorAll(AUXILIARY_SELECTOR)].filter(el=>el instanceof HTMLElement);}
function hideExcept(keep){dynamicModules().forEach(el=>{if(el!==keep)el.classList.add('hidden');});}
function showTarget(name){const id=CORE[name]||`${name}Module`;const target=document.getElementById(id);hideExcept(target||null);if(!target)return false;target.classList.remove('hidden');return true;}
function infer(btn){if(btn.id==='placesNavBtn')return'places';if(btn.id==='businessAccessNavBtn')return'businessAccess';const raw=btn.getAttribute('onclick')||'';const match=raw.match(/showAdminModule\(['"]([^'"]+)['"]\)/);return match?.[1]||btn.dataset.module||btn.dataset.adminModule||'';}
function bind(){
 // El laboratorio V2 se montaba con un id que no terminaba en "Module" y quedaba visible globalmente.
 // Lo ocultamos de entrada; solo una integración explícita de Misiones deberá mostrarlo.
 hideExcept(null);
 document.addEventListener('click',e=>{const btn=e.target.closest('button,a');if(!btn)return;const name=infer(btn);if(!name)return;queueMicrotask(()=>showTarget(name));});
 const original=window.showAdminModule;if(typeof original==='function'&&!original.__isolated){const wrapped=function(name,...args){const result=original.apply(this,[name,...args]);queueMicrotask(()=>showTarget(name));return result;};wrapped.__isolated=true;window.showAdminModule=wrapped;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();