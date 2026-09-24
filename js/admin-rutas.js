/* Visita Loja — administración de rutas turísticas */
(function () {
  'use strict';

  const COLLECTION = 'touristRoutes';
  let touristRoutes = [];
  let draftStops = [];
  let routePlaces = [];

  function getDb() {
    if (typeof db !== 'undefined' && db) return db;
    if (window.firebase && firebase.firestore) return firebase.firestore();
    throw new Error('Firestore no está disponible.');
  }

  function cleanText(value, maxLength) { return String(value || '').trim().slice(0, maxLength); }
  function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }

  function normalizeStops(stops) {
    if (!Array.isArray(stops)) return [];
    const seen = new Set();
    return stops.map((stop) => typeof stop === 'string' ? stop : stop && stop.id).map((id) => String(id || '').trim()).filter((id) => id && !seen.has(id) && seen.add(id)).map((id, index) => ({ id, order: index }));
  }

  function normalizeRoute(input) {
    const route = input || {};
    return { name: cleanText(route.name,120), description: cleanText(route.description,1200), duration: cleanText(route.duration,80), image: cleanText(route.image,1000), status: route.status === 'published' ? 'published' : 'draft', stops: normalizeStops(route.stops) };
  }

  function validateRoute(route) {
    if (!route.name) throw new Error('La ruta necesita un nombre.');
    if (!route.description) throw new Error('La ruta necesita una descripción.');
    if (!route.stops.length) throw new Error('Agrega al menos una parada a la ruta.');
    return route;
  }

  async function loadTouristRoutes() {
    const snapshot = await getDb().collection(COLLECTION).get();
    touristRoutes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    touristRoutes.sort((a,b) => String(a.name||'').localeCompare(String(b.name||''),'es'));
    return touristRoutes.slice();
  }

  async function saveTouristRoute(routeId,input) {
    const route=validateRoute(normalizeRoute(input));
    const payload={...route,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(routeId){await getDb().collection(COLLECTION).doc(String(routeId)).set(payload,{merge:true});return String(routeId);}
    payload.createdAt=firebase.firestore.FieldValue.serverTimestamp();
    const doc=await getDb().collection(COLLECTION).add(payload);return doc.id;
  }

  async function deleteTouristRoute(routeId){if(!routeId)throw new Error('Ruta no válida.');await getDb().collection(COLLECTION).doc(String(routeId)).delete();}
  async function setTouristRouteStatus(routeId,status){if(!routeId)throw new Error('Ruta no válida.');await getDb().collection(COLLECTION).doc(String(routeId)).update({status:status==='published'?'published':'draft',updatedAt:firebase.firestore.FieldValue.serverTimestamp()});}

  function availablePlaces(){return routePlaces.slice();}
  function placeName(id){return routePlaces.find((place)=>place.id===id)?.name||id;}

  async function loadRoutePlaces(){
    const snapshot=await getDb().collection('locales').get();
    routePlaces=snapshot.docs.map((doc)=>{const data=doc.data()||{};return {id:doc.id,name:String(data.nombre||data.name||data.title||data.titulo||'Parada sin nombre')};}).sort((a,b)=>a.name.localeCompare(b.name,'es'));
    return routePlaces.slice();
  }

  function renderStops(){
    const container=document.getElementById('touristRouteStops');if(!container)return;
    if(!draftStops.length){container.innerHTML='<p class="text-sm text-gray-500 border border-dashed border-gray-700 rounded-xl p-4">Todavía no has agregado paradas.</p>';return;}
    container.innerHTML=draftStops.map((id,index)=>`<div class="flex items-center gap-2 bg-black/25 border border-gray-800 rounded-xl p-3"><span class="w-7 h-7 shrink-0 rounded-full bg-blue-500/15 text-blue-300 flex items-center justify-center text-xs font-black">${index+1}</span><span class="min-w-0 flex-1 text-sm font-bold truncate">${escapeHtml(placeName(id))}</span><button type="button" data-route-up="${index}" class="border border-gray-700 rounded-lg px-2 py-1 text-xs" title="Subir">↑</button><button type="button" data-route-down="${index}" class="border border-gray-700 rounded-lg px-2 py-1 text-xs" title="Bajar">↓</button><button type="button" data-route-remove="${index}" class="border border-red-500/30 text-red-300 rounded-lg px-2 py-1 text-xs" title="Quitar"><i class="fa-solid fa-xmark"></i></button></div>`).join('');
  }

  function editorMarkup(route,loading,error){
    const current=normalizeRoute(route||{});draftStops=current.stops.map((stop)=>stop.id);
    const options=availablePlaces().map((place)=>`<option value="${escapeHtml(place.id)}">${escapeHtml(place.name)}</option>`).join('');
    const selector=loading?'<option value="">Cargando paradas…</option>':error?'<option value="">No se pudieron cargar las paradas</option>':`<option value="">Selecciona una parada…</option>${options}`;
    return `<form id="touristRouteEditor" class="bg-black/25 border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-5" data-route-id="${escapeHtml(route?.id||'')}"><div class="grid md:grid-cols-2 gap-4"><label class="block"><span class="text-sm font-semibold block mb-2">Nombre de la ruta</span><input id="touristRouteName" class="field" maxlength="120" value="${escapeHtml(current.name)}" placeholder="Ej. Loja Histórica"></label><label class="block"><span class="text-sm font-semibold block mb-2">Duración aproximada</span><input id="touristRouteDuration" class="field" maxlength="80" value="${escapeHtml(current.duration)}" placeholder="Ej. 2 horas 30 min"></label></div><label class="block"><span class="text-sm font-semibold block mb-2">Descripción</span><textarea id="touristRouteDescription" class="field min-h-28" maxlength="1200" placeholder="Describe la experiencia y para quién es ideal.">${escapeHtml(current.description)}</textarea></label><label class="block"><span class="text-sm font-semibold block mb-2">Imagen de portada</span><input id="touristRouteImage" class="field" maxlength="1000" value="${escapeHtml(current.image)}" placeholder="URL de imagen (opcional)"></label><div class="border border-gray-800 rounded-2xl p-4"><div class="flex flex-col sm:flex-row sm:items-end gap-3 mb-4"><label class="block flex-1"><span class="text-sm font-semibold block mb-2">Agregar parada existente</span><select id="touristRoutePlaceSelect" class="field" ${loading||error?'disabled':''}>${selector}</select></label><button id="addTouristRouteStopBtn" type="button" class="border border-blue-500/40 text-blue-200 rounded-xl px-4 py-3 text-sm font-black" ${loading||error?'disabled':''}><i class="fa-solid fa-plus mr-1"></i>Agregar</button></div>${error?`<p class="text-xs text-red-300 mb-3">${escapeHtml(error)}</p>`:''}<div id="touristRouteStops" class="space-y-2"></div></div><div class="flex flex-wrap items-center gap-3"><button id="previewTouristRouteBtn" type="button" class="bg-blue-500 hover:bg-blue-400 text-white rounded-xl px-5 py-3 font-black"><i class="fa-solid fa-eye mr-2"></i>Vista previa</button><button id="cancelTouristRouteBtn" type="button" class="border border-gray-700 rounded-xl px-5 py-3 font-bold">Cancelar</button><span class="text-xs text-amber-300"><i class="fa-solid fa-flask mr-1"></i>Modo de interfaz: todavía no guarda en Firestore.</span></div><div id="touristRoutePreview" class="hidden border border-blue-500/25 bg-blue-500/5 rounded-2xl p-4"></div></form>`;
  }

  async function renderEditor(route){
    const list=document.getElementById('touristRoutesList');if(!list)return;
    list.innerHTML=editorMarkup(route,true);renderStops();
    try{await loadRoutePlaces();list.innerHTML=editorMarkup(route,false);renderStops();}
    catch(error){console.error('No se pudieron cargar las paradas para rutas:',error);list.innerHTML=editorMarkup(route,false,'No fue posible leer la colección de paradas.');renderStops();}
  }

  function renderPreview(){const box=document.getElementById('touristRoutePreview');if(!box)return;const name=cleanText(document.getElementById('touristRouteName')?.value,120)||'Ruta sin nombre',description=cleanText(document.getElementById('touristRouteDescription')?.value,1200)||'Sin descripción todavía.',duration=cleanText(document.getElementById('touristRouteDuration')?.value,80);box.innerHTML=`<p class="text-xs font-black uppercase tracking-widest text-blue-300">Vista previa</p><h3 class="text-xl font-black mt-1">${escapeHtml(name)}</h3>${duration?`<p class="text-sm text-gray-400 mt-1"><i class="fa-regular fa-clock mr-1"></i>${escapeHtml(duration)}</p>`:''}<p class="text-sm text-gray-300 mt-3">${escapeHtml(description)}</p><div class="mt-4 space-y-2">${draftStops.map((id,index)=>`<div class="text-sm"><span class="font-black text-blue-300 mr-2">${index+1}.</span>${escapeHtml(placeName(id))}</div>`).join('')||'<p class="text-sm text-gray-500">Sin paradas.</p>'}</div>`;box.classList.remove('hidden');}
  function closeEditor(){const list=document.getElementById('touristRoutesList');if(list)list.innerHTML='<p class="text-sm text-gray-500">Pulsa “Nueva ruta” para preparar un recorrido oficial.</p>';draftStops=[];}

  document.addEventListener('click',(event)=>{
    if(event.target.closest('#newTouristRouteBtn')){renderEditor();return;}
    if(event.target.closest('#cancelTouristRouteBtn'))return closeEditor();
    if(event.target.closest('#previewTouristRouteBtn'))return renderPreview();
    if(event.target.closest('#addTouristRouteStopBtn')){const select=document.getElementById('touristRoutePlaceSelect'),id=String(select?.value||'');if(id&&!draftStops.includes(id))draftStops.push(id);if(select)select.value='';return renderStops();}
    const remove=event.target.closest('[data-route-remove]');if(remove){draftStops.splice(Number(remove.dataset.routeRemove),1);return renderStops();}
    const up=event.target.closest('[data-route-up]');if(up){const index=Number(up.dataset.routeUp);if(index>0)[draftStops[index-1],draftStops[index]]=[draftStops[index],draftStops[index-1]];return renderStops();}
    const down=event.target.closest('[data-route-down]');if(down){const index=Number(down.dataset.routeDown);if(index<draftStops.length-1)[draftStops[index+1],draftStops[index]]=[draftStops[index],draftStops[index+1]];return renderStops();}
  });

  document.addEventListener('DOMContentLoaded',closeEditor);
  window.VisitaLojaAdminRoutes=Object.freeze({load:loadTouristRoutes,save:saveTouristRoute,remove:deleteTouristRoute,setStatus:setTouristRouteStatus,normalize:normalizeRoute,loadPlaces:loadRoutePlaces,openEditor:renderEditor});
})();
