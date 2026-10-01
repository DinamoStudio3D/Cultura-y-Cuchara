/* VisitaLoja.com — Patrocinadores públicos. Independiente de Marcas Aliadas. */
(function(){
'use strict';

const SPONSORS=[
 {id:'banco-de-loja',name:'Banco de Loja',image:'banco-de-loja.png'},
 {id:'ile',name:'ILE',image:'ile.png'},
 {id:'netplus',name:'NettPlus',image:'netplus.png'}
];

function card(item){
 const el=document.createElement('div');
 el.className='vl-sponsor vl-sponsor--'+item.id;
 el.setAttribute('aria-label',item.name);
 const img=document.createElement('img');
 img.className='vl-sponsor__logo';img.src=item.image;img.alt=item.name;img.loading='lazy';img.decoding='async';
 el.appendChild(img);return el;
}

function render(){
 if(document.getElementById('patrocinadoresVisitaLoja'))return;
 const section=document.createElement('section');section.id='patrocinadoresVisitaLoja';section.className='vl-sponsors';section.setAttribute('aria-labelledby','vlSponsorsTitle');
 const inner=document.createElement('div');inner.className='vl-sponsors__inner';inner.innerHTML='<header class="vl-sponsors__heading"><p class="vl-sponsors__eyebrow">Patrocinadores</p><h2 id="vlSponsorsTitle" class="vl-sponsors__title">Empresas que impulsan Loja</h2><p class="vl-sponsors__subtitle">Gracias a quienes apuestan por el turismo, la cultura y el desarrollo de nuestra provincia.</p></header>';
 const grid=document.createElement('div');grid.className='vl-sponsors__grid';SPONSORS.forEach(item=>grid.appendChild(card(item)));inner.appendChild(grid);section.appendChild(inner);
 const support=document.getElementById('apoya')||document.getElementById('support')||document.querySelector('footer');
 if(support&&support.parentNode)support.parentNode.insertBefore(section,support);else document.body.appendChild(section);
}

function sponsorSignature(sponsor,logo,label){
 const box=document.createElement('div');
 box.className='vl-experience-sponsor mt-5 inline-flex items-center gap-2 rounded-full border border-brandGold/30 bg-white/90 px-3 py-2 shadow-sm';
 box.innerHTML='<img src="'+logo+'" alt="" class="w-7 h-7 object-contain" loading="lazy"><span class="text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-600">'+label+' <strong class="text-brandDark">'+sponsor+'</strong></span>';
 return box;
}

function renderSponsoredExperiences(){
 // Banco de Loja: la firma pertenece a la experiencia de apoyo al talento local, no a cada emprendimiento.
 const entrepreneurs=document.getElementById('emprendedores');
 if(entrepreneurs&&!entrepreneurs.querySelector('[data-sponsor-experience="banco"]')){
   const intro=entrepreneurs.querySelector('.text-center');
   if(intro){const wrap=document.createElement('div');wrap.dataset.sponsorExperience='banco';wrap.appendChild(sponsorSignature('Banco de Loja','banco-de-loja.png','Descubre y apoya lo nuestro · con el apoyo de'));intro.appendChild(wrap);}
 }

 // ILE: se integra en la experiencia gastronómica ya existente, sin atribuir patrocinio a restaurantes individuales.
 const spices=document.getElementById('especias');
 if(spices&&!spices.querySelector('[data-sponsor-experience="ile"]')){
   const intro=spices.querySelector('.text-center');
   if(intro){const wrap=document.createElement('div');wrap.dataset.sponsorExperience='ile';wrap.appendChild(sponsorSignature('ILE','ile.png','Sabores de Loja · con el apoyo de'));intro.appendChild(wrap);}
 }

 // NettPlus: firma de la experiencia digital del mapa, no de los puntos mostrados en él.
 const map=document.getElementById('mapa');
 if(map&&!map.querySelector('[data-sponsor-experience="netplus"]')){
   const intro=map.querySelector('.text-center');
   if(intro){const wrap=document.createElement('div');wrap.dataset.sponsorExperience='netplus';wrap.appendChild(sponsorSignature('NettPlus','netplus.png','Explora Loja conectado · con el apoyo de'));intro.appendChild(wrap);}
 }
}

function init(){render();renderSponsoredExperiences();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.VisitaLojaSponsors={render,sponsors:SPONSORS.slice(),renderSponsoredExperiences};
})();
