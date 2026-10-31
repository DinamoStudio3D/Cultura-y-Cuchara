/* UI proposal only. Reads public places; no login, writes, stamps or push registrations. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),model=window.VisitaLojaDiscovery;
 const categories={cafe:'Cafetería',hotel:'Hospedaje',restaurante:'Gastronomía',hueca:'Gastronomía',urbana:'Gastronomía',asadero:'Gastronomía',cevicheria:'Gastronomía',turismo:'Turismo',aliado:'Marca aliada',panaderia:'Panadería',heladeria:'Heladería',artesania:'Comercio local',bar:'Bar',entretenimiento:'Entretenimiento'};
 let records=[],category='all',tab='home',saved=new Set(),loaded=false,selected=null,timer;
 const text=value=>typeof value==='string'?value:'';
 function imageURL(value){const raw=text(value).trim();if(!raw)return '';try{const url=new URL(raw,location.origin);return url.protocol==='https:'||url.origin===location.origin?url.href:'';}catch(_){return '';}}
 function photo(place){const hero=typeof place.heroImage==='string'?place.heroImage:place.heroImage?.url||place.heroImage?.img;return imageURL(hero)||imageURL((place.gallery||[]).find(item=>item?.img)?.img)||'/assets/photos/photo-unavailable.svg';}
 function image(element,source){if(source==='https://i.imgur.com/CpCnMpw.png')source='/assets/brand/codeproim.png';if(source.includes('/assets/brand/'))element.style.objectFit='contain';else element.style.objectFit='cover';element.onerror=()=>{element.onerror=null;element.src='/assets/photos/photo-unavailable.svg';};if(window.VisitaLojaResponsivePhotos)window.VisitaLojaResponsivePhotos.set(element,source,'(max-width: 480px) 100vw, 390px');else element.src=source;}
 function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');svg.setAttribute('aria-hidden','true');use.setAttribute('href','#'+name);svg.append(use);return svg;}
 function toast(message){clearTimeout(timer);$('appToast').textContent=message;$('appToast').hidden=false;timer=setTimeout(()=>$('appToast').hidden=true,2800);}
 function toggle(id){if(saved.has(id))saved.delete(id);else saved.add(id);render();if(selected?.id===id)$('detailSave').querySelector('span').textContent=saved.has(id)?'Quitar de esta propuesta':'Guardar en esta propuesta';toast(saved.has(id)?'Guardado solo en esta propuesta de diseño.':'Quitado de los favoritos de esta propuesta.');}
 function detail(place){selected=place;$('detailTitle').textContent=text(place.title);$('detailCategory').textContent=categories[place.category]||'Parada de VisitaLoja';$('detailAddress').textContent=text(place.address)||'Loja, Ecuador';$('detailDescription').textContent=text(place.description||place.desc).replace(/<[^>]*>/g,'').trim()||'Descubre esta parada de VisitaLoja.';$('detailImage').alt=text(place.title);image($('detailImage'),photo(place));$('detailSave').querySelector('span').textContent=saved.has(place.id)?'Quitar de esta propuesta':'Guardar en esta propuesta';$('placeDetail').showModal();}
 function card(place){const host=document.createElement('article'),open=document.createElement('button'),cover=document.createElement('div'),img=document.createElement('img'),label=document.createElement('span'),meta=document.createElement('div'),title=document.createElement('h3'),address=document.createElement('p'),save=document.createElement('button');host.className='place-card';open.className='place-open';open.type='button';open.setAttribute('aria-label','Ver ficha de '+text(place.title));cover.className='place-cover';img.alt=text(place.title);img.loading='lazy';img.decoding='async';image(img,photo(place));label.textContent=categories[place.category]||'VisitaLoja';cover.append(img,label);meta.className='place-meta';title.textContent=text(place.title);address.textContent=text(place.address)||'Loja, Ecuador';meta.append(title,address);open.append(cover,meta);open.onclick=()=>detail(place);save.type='button';save.className='save-place';save.setAttribute('aria-label',(saved.has(place.id)?'Quitar de favoritos: ':'Guardar favorito: ')+text(place.title));save.setAttribute('aria-pressed',String(saved.has(place.id)));save.append(icon('heart'));save.onclick=()=>toggle(place.id);host.append(open,save);return host;}
 function render(){
  $('homePlaces').replaceChildren(...records.slice(0,4).map(card));
  const query=$('appSearch').value,filtered=records.filter(place=>model.matches(place,{query,category,savedOnly:tab==='saved',savedIds:[...saved]},()=>false));
  $('explorePlaces').replaceChildren(...filtered.map(card));$('clearSearch').hidden=!query;$('emptyResults').hidden=!loaded||filtered.length>0;
  $('resultCount').textContent=loaded?(filtered.length===1?'1 lugar para descubrir':filtered.length+' lugares para descubrir'):'Cargando paradas…';
  for(const button of document.querySelectorAll('[data-filter]'))button.setAttribute('aria-pressed',String(button.dataset.filter===category));
 }
 function navigate(next,filter='all'){tab=next;category=filter;$('appSearch').value='';$('homeView').hidden=tab!=='home';$('exploreView').hidden=tab==='home';$('exploreTitle').textContent=tab==='saved'?'Tus lugares favoritos':'Explora Loja';$('filterChips').hidden=tab==='saved';for(const button of document.querySelectorAll('[data-tab]')){if(button.dataset.tab===tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}render();$('appContent').scrollTop=0;}
 let database;
 async function load(){
  $('loadState').hidden=false;$('loadState').querySelector('p').textContent='Buscando lugares para ti…';$('loadState').querySelector('.spinner').hidden=false;$('retryLoad').hidden=true;
  try{
   if(!database){const app=firebase.initializeApp({apiKey:'AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE',authDomain:'cultura-y-cuchara.firebaseapp.com',projectId:'cultura-y-cuchara'},'visitalojaAndroidDesign');database=app.firestore();}
   const snapshot=await database.collection('locales').get({source:'server'});
   records=snapshot.docs.map(doc=>({...doc.data(),id:doc.id})).filter(place=>model.matches(place,{query:'',category:'all'},()=>false));loaded=true;render();$('loadState').hidden=true;
  }catch(_){loaded=false;$('loadState').querySelector('.spinner').hidden=true;$('loadState').querySelector('p').textContent='No pudimos cargar los lugares publicados. Comprueba tu conexión y vuelve a intentar.';$('retryLoad').hidden=false;}
 }
 for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>navigate(button.dataset.tab);
 for(const button of document.querySelectorAll('[data-category]'))button.onclick=()=>navigate('explore',button.dataset.category);
 for(const button of document.querySelectorAll('[data-filter]'))button.onclick=()=>{category=button.dataset.filter;render();};
 for(const id of ['heroExplore','allPlaces','allCategories'])$(id).onclick=()=>navigate('explore');
 $('homeSearch').onclick=()=>{navigate('explore');$('appSearch').focus();};$('appSearch').oninput=render;$('clearSearch').onclick=()=>{$('appSearch').value='';render();$('appSearch').focus();};$('resetFilters').onclick=()=>navigate('explore');$('retryLoad').onclick=load;$('closeDetail').onclick=()=>$('placeDetail').close();$('detailSave').onclick=()=>selected&&toggle(selected.id);
 load();
})();
