(function(){
'use strict';
const COLLECTION='businessAccess';
let rows=[],places=[];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
function normalizeEmail(v){return String(v||'').trim().toLowerCase();}
function accessId(email,placeId){const e=normalizeEmail(email);if(!e||e.includes('/')||String(placeId).includes('/'))throw new Error('Correo o negocio inválido.');return `${placeId}__${e}`.slice(0,300);}
function placeLabel(p){return p.title||p.name||p.titleEn||p.id;}
async function loadPlaces(){
 const select=$('businessAccessPlace');if(select)select.innerHTML='<option value="">Cargando paradas…</option>';
 // Reutiliza primero la misma lista viva que ya mantiene el Admin. Así no hacemos una segunda lectura innecesaria.
 if(Array.isArray(window.adminPlaces)&&window.adminPlaces.length){places=window.adminPlaces.map(p=>({...p}));}
 else if(typeof adminPlaces!=='undefined'&&Array.isArray(adminPlaces)&&adminPlaces.length){places=adminPlaces.map(p=>({...p}));}
 else {const snap=await db.collection('locales').get();places=snap.docs.map(d=>({id:d.id,...d.data()}));}
 places.sort((a,b)=>String(placeLabel(a)).localeCompare(String(placeLabel(b)),'es'));
 if(select)select.innerHTML='<option value="">Selecciona una parada o negocio…</option>'+places.map(p=>`<option value="${esc(p.id)}">${esc(placeLabel(p))}</option>`).join('');
}
async function load(){
 // db es una constante global del admin, no una propiedad window.db. La comprobación anterior detenía toda la carga.
 if(typeof db==='undefined')throw new Error('FIRESTORE_NOT_READY');
 await loadPlaces();
 try{const snap=await db.collection(COLLECTION).get();rows=snap.docs.map(d=>({id:d.id,...d.data()}));render();}
 catch(error){rows=[];render();const list=$('businessAccessList');if(list)list.insertAdjacentHTML('afterbegin','<div class="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200 mb-3">Las paradas ya están disponibles. El listado de accesos se habilitará cuando publiquemos las reglas de seguridad de businessAccess.</div>');console.warn('businessAccess pendiente:',error);}
}
function render(){const list=$('businessAccessList');if(!list)return;const q=normalizeEmail($('businessAccessSearch')?.value);const filtered=rows.filter(r=>!q||[r.email,r.displayName,r.placeName,r.role].some(v=>String(v||'').toLowerCase().includes(q)));$('businessAccessCount')&&($('businessAccessCount').textContent=String(filtered.length));if(!filtered.length){list.innerHTML='<div class="rounded-2xl border border-dashed border-white/10 p-8 text-center text-gray-500">Todavía no hay accesos asignados.</div>';return;}list.innerHTML=filtered.sort((a,b)=>String(a.placeName||'').localeCompare(String(b.placeName||''))).map(r=>`<article class="rounded-2xl border border-white/10 bg-black/20 p-4 flex flex-col lg:flex-row lg:items-center gap-4"><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><b class="text-white">${esc(r.displayName||r.email)}</b><span class="text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-1 ${r.active!==false?'bg-emerald-500/10 text-emerald-300':'bg-red-500/10 text-red-300'}">${r.active!==false?'Activo':'Desactivado'}</span></div><p class="text-sm text-gray-400 mt-1">${esc(r.email)}</p><p class="text-sm mt-2"><span class="text-cyan-300 font-bold">${esc(r.placeName||r.placeId)}</span><span class="text-gray-600 mx-2">•</span><span class="text-amber-300">${r.role==='manager'?'Encargado':'Propietario'}</span></p></div><div class="flex flex-wrap gap-2"><button type="button" data-access-toggle="${esc(r.id)}" class="border border-white/10 rounded-xl px-3 py-2 text-sm">${r.active!==false?'Desactivar':'Activar'}</button><button type="button" data-access-delete="${esc(r.id)}" class="border border-red-500/20 text-red-300 rounded-xl px-3 py-2 text-sm">Quitar</button></div></article>`).join('');}
async function save(e){e.preventDefault();const email=normalizeEmail($('businessAccessEmail')?.value),placeId=$('businessAccessPlace')?.value,role=$('businessAccessRole')?.value||'owner',displayName=String($('businessAccessName')?.value||'').trim();if(!email||!placeId){alert('Selecciona una parada o negocio e ingresa el correo.');return;}const place=places.find(p=>p.id===placeId);const id=accessId(email,placeId);await db.collection(COLLECTION).doc(id).set({email,displayName,placeId,placeName:placeLabel(place||{id:placeId}),role,active:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:firebase.auth().currentUser?.uid||''},{merge:true});$('businessAccessForm')?.reset();await load();}
async function action(e){const toggle=e.target.closest('[data-access-toggle]'),del=e.target.closest('[data-access-delete]');if(toggle){const r=rows.find(x=>x.id===toggle.dataset.accessToggle);if(r){await db.collection(COLLECTION).doc(r.id).update({active:r.active===false,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:firebase.auth().currentUser?.uid||''});await load();}}if(del){const r=rows.find(x=>x.id===del.dataset.accessDelete);if(r&&confirm(`¿Quitar el acceso de ${r.email} a ${r.placeName||r.placeId}?`)){await db.collection(COLLECTION).doc(r.id).delete();await load();}}}
function init(){const form=$('businessAccessForm');if(!form)return;form.addEventListener('submit',save);$('businessAccessSearch')?.addEventListener('input',render);$('businessAccessList')?.addEventListener('click',action);window.addEventListener('visitaloja:admin-ready',()=>load().catch(err=>{console.error(err);const list=$('businessAccessList');if(list)list.innerHTML='<p class="text-red-300 text-sm">No se pudieron cargar las paradas. Revisa la conexión con Firestore.</p>';}));}
window.VisitaLojaBusinessAccess={init,load,accessId};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
