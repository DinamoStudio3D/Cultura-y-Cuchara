(function(){
'use strict';
const CORE={places:'placesModule',businessAccess:'businessAccessModule'};
function dynamicModules(){return [...document.querySelectorAll('[id$="Module"], [data-admin-module], [data-module]')].filter(el=>el instanceof HTMLElement);}
function hideExcept(keep){dynamicModules().forEach(el=>{if(el!==keep)el.classList.add('hidden');});}
function showTarget(name){const id=CORE[name]||`${name}Module`;const target=document.getElementById(id);if(!target)return false;hideExcept(target);target.classList.remove('hidden');return true;}
function infer(btn){if(btn.id==='placesNavBtn')return'places';if(btn.id==='businessAccessNavBtn')return'businessAccess';const raw=btn.getAttribute('onclick')||'';const match=raw.match(/showAdminModule\(['"]([^'"]+)['"]\)/);return match?.[1]||btn.dataset.module||btn.dataset.adminModule||'';}
function bind(){document.addEventListener('click',e=>{const btn=e.target.closest('button,a');if(!btn)return;const name=infer(btn);if(!name)return;queueMicrotask(()=>showTarget(name));});
 const original=window.showAdminModule;if(typeof original==='function'&&!original.__isolated){const wrapped=function(name,...args){const result=original.apply(this,[name,...args]);queueMicrotask(()=>showTarget(name));return result;};wrapped.__isolated=true;window.showAdminModule=wrapped;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();