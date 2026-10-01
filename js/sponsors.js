/* VisitaLoja.com — Patrocinadores públicos. Independiente de Marcas Aliadas. */
(function(){'use strict';
const SPONSORS=[
 {id:'banco-de-loja',name:'Banco de Loja',image:'images/patrocinadores/banco-de-loja.png'},
 {id:'ile',name:'ILE',image:'images/patrocinadores/ile.png'},
 {id:'netplus',name:'Netplus',image:'images/patrocinadores/netplus.jpg'}
];
function card(item){const el=document.createElement('div');el.className='vl-sponsor vl-sponsor--'+item.id;el.setAttribute('aria-label',item.name);const img=document.createElement('img');img.className='vl-sponsor__logo';img.src=item.image;img.alt=item.name;img.loading='lazy';img.decoding='async';el.appendChild(img);return el}
function render(){if(document.getElementById('patrocinadoresVisitaLoja'))return;const section=document.createElement('section');section.id='patrocinadoresVisitaLoja';section.className='vl-sponsors';section.setAttribute('aria-labelledby','vlSponsorsTitle');const inner=document.createElement('div');inner.className='vl-sponsors__inner';inner.innerHTML='<header class="vl-sponsors__heading"><p class="vl-sponsors__eyebrow">Patrocinadores</p><h2 id="vlSponsorsTitle" class="vl-sponsors__title">Empresas que impulsan Loja</h2><p class="vl-sponsors__subtitle">Gracias a quienes apuestan por el turismo, la cultura y el desarrollo de nuestra provincia.</p></header>';const grid=document.createElement('div');grid.className='vl-sponsors__grid';SPONSORS.forEach(item=>grid.appendChild(card(item)));inner.appendChild(grid);section.appendChild(inner);const support=document.getElementById('apoya')||document.getElementById('support')||document.querySelector('footer');if(support&&support.parentNode)support.parentNode.insertBefore(section,support);else document.body.appendChild(section)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
window.VisitaLojaSponsors={render,sponsors:SPONSORS.slice()};
})();
