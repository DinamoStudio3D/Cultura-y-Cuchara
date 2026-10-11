/* Standalone canton routes share the catalogue and assignments from Admin. */
(function(){
 'use strict';
 const catalogue=window.ChabaquitoPlaceConfig?.CANTONS||[],el=id=>document.getElementById(id);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 if(el('cantonGrid')){
  function render(){const visible=catalogue.filter(c=>normalize(c.name).includes(normalize(el('cantonSearch').value)));el('cantonGrid').innerHTML=visible.map(c=>`<a class="canton-card" href="canton.html?canton=${encodeURIComponent(c.id)}"><span class="canton-card-icon" aria-hidden="true">↗</span><strong>${esc(c.name)}</strong><span>Provincia de Loja</span><small>Conocer ${esc(c.name)} →</small></a>`).join('');el('cantonSearchStatus').textContent=visible.length?visible.length+' cantones para explorar.':'No encontramos un cantón con ese nombre.';}
  el('cantonSearch').addEventListener('input',render);render();return;
 }
 if(!el('cantonTitle'))return;
 const canton=catalogue.find(c=>c.id===new URLSearchParams(location.search).get('canton'));
 if(!canton){el('cantonTitle').textContent='Cantón no encontrado';el('cantonIntro').textContent='Regresa a todos los cantones para escoger uno de los 16 cantones de Loja.';return;}
 document.title=canton.name+' | Visita Loja';el('cantonTitle').textContent=canton.name;el('cantonIntro').textContent='Explora los lugares y negocios de '+canton.name+'. Abre cada ficha para consultar su descripción, ubicación y más información.';el('cantonResults').hidden=false;
 function renderPlaces(records){const places=records.filter(p=>p.cantonId===canton.id&&p.active!==false&&(!p.publicationStatus||p.publicationStatus==='published')&&!/motel/i.test([p.category,p.tag,p.title,p.type].join(' ')));el('cantonResultsCount').textContent=places.length+' '+(places.length===1?'lugar publicado':'lugares publicados')+' en '+canton.name+'.';el('cantonPlaces').innerHTML=places.length?places.map(p=>`<article class="canton-place"><span>${esc(p.tag||'Parada Visita Loja')}</span><h3>${esc(p.title||p.id)}</h3><p>${esc(p.desc||p.description||'Consulta la ficha para conocer este lugar.')}</p>${p.address?'<p>'+esc(p.address)+'</p>':''}<a href="/?lugar=${encodeURIComponent(p.id)}">Ver información del lugar →</a></article>`).join(''):`<p class="canton-empty">Estamos preparando más información de ${esc(canton.name)}. Todavía no hay lugares publicados con este cantón asignado.</p>`;}
 let db;
 async function load(){el('cantonRetry').hidden=true;el('cantonResultsCount').textContent='Cargando lugares publicados…';el('cantonPlaces').innerHTML='';try{if(!db){if(!window.firebase)throw new Error('SDK unavailable');const app=firebase.initializeApp({apiKey:'AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE',authDomain:'cultura-y-cuchara.firebaseapp.com',projectId:'cultura-y-cuchara',appId:'1:974351327730:web:08573026a46d1bb6598b6b'},'viveLojaCantons');db=app.firestore();}const snapshot=await db.collection('locales').where('cantonId','==',canton.id).get();renderPlaces(snapshot.docs.map(d=>({...d.data(),id:d.id})));}catch(error){el('cantonResultsCount').textContent='No pudimos cargar los lugares de '+canton.name+'. Vuelve a intentarlo.';el('cantonRetry').hidden=false;}}
 el('cantonRetry').addEventListener('click',load);load();
})();
