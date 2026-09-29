(function(){
'use strict';
const GROUPS=[
 {id:'basic',label:'Información',icon:'fa-circle-info',ids:['placePublished','placeName','placeNameEn','placeCategory','placeDescription','placeDescriptionEn']},
 {id:'location',label:'Ubicación',icon:'fa-map-location-dot',ids:['placeAddress','placeLat','placeLng','placeMapUrl']},
 {id:'media',label:'Imágenes y contenido',icon:'fa-images',ids:['placeImage','placeImages','placeLogo','placeAudio','placeAudioEn']},
 {id:'contact',label:'Contacto y horarios',icon:'fa-address-card',ids:['placePhone','placeWhatsapp','placeHours','placeWebsite','placeInstagram','placeFacebook']},
 {id:'visits',label:'Visitas y QR',icon:'fa-qrcode',ids:['placeValidationMode','placeValidationModeWrap','selfCheckinQrCard','placePassport']},
 {id:'commercial',label:'Plan y herramientas',icon:'fa-handshake',ids:['placePlan','placeSubscription','placeBenefitLogoPin','placeBenefitMenu','placeCommerceWhatsapp','placeMenuActive','placePromoActive']}
];
function closestBlock(el,form){if(!el)return null;let n=el;while(n&&n.parentElement!==form){if(n.matches('fieldset,details,[data-place-section]'))return n;n=n.parentElement;}return n&&n!==form?n:null;}
function mount(){const form=document.getElementById('placeForm');if(!form||form.dataset.organized==='1')return;form.dataset.organized='1';const title=document.getElementById('placeFormTitle');if(!title)return;
 const intro=document.createElement('div');intro.className='rounded-2xl border border-cyan-500/20 bg-cyan-500/[.06] p-4';intro.innerHTML='<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><p class="text-[10px] font-black uppercase tracking-widest text-cyan-300">Editor de parada</p><p class="text-sm text-gray-400 mt-1">Completa la ficha por bloques. Puedes saltar directamente a la sección que necesites.</p></div><span class="text-xs text-gray-500"><i class="fa-solid fa-shield-halved mr-1"></i>No cambia cómo se guardan los datos</span></div><div id="placeEditorNav" class="flex gap-2 overflow-x-auto hide-scrollbar mt-4 pb-1"></div>';
 title.insertAdjacentElement('afterend',intro);const nav=intro.querySelector('#placeEditorNav');
 const assigned=new Set();GROUPS.forEach(g=>{let target=null;for(const id of g.ids){const el=document.getElementById(id);const block=closestBlock(el,form);if(block&&!assigned.has(block)){target=block;break;}}if(!target)return;assigned.add(target);target.dataset.placeSection=g.id;target.classList.add('scroll-mt-28');const b=document.createElement('button');b.type='button';b.className='shrink-0 rounded-xl border border-white/10 bg-black/25 hover:border-cyan-400/40 px-3 py-2 text-xs font-bold text-gray-300';b.innerHTML=`<i class="fa-solid ${g.icon} text-cyan-300 mr-1.5"></i>${g.label}`;b.addEventListener('click',()=>{target.scrollIntoView({behavior:'smooth',block:'start'});target.animate([{outline:'2px solid rgba(34,211,238,.55)'},{outline:'2px solid transparent'}],{duration:1200});});nav.appendChild(b);});
 const listTitle=[...document.querySelectorAll('#placesModule h3')].find(x=>x.textContent.includes('Paradas registradas'));if(listTitle){const box=listTitle.closest('.flex');box?.classList.add('rounded-2xl','border','border-white/10','bg-white/[.02]','p-4');}
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();