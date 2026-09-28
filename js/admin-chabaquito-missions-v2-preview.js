/*
 * Admin preview — Misiones de Chabaquito V2.
 * Fase segura: solo interfaz + validación con el modelo V2.
 * Lee la colección locales para facilitar la selección, pero NO escribe Firestore.
 */
(() => {
  'use strict';
  const model = window.visitaLojaChabaquitoMissionsV2;
  if (!model || document.getElementById('chabaquitoMissionsV2Preview')) return;

  function mount() {
    const adminContent = document.querySelector('.admin-content');
    if (!adminContent) return;

    const section = document.createElement('section');
    section.id = 'chabaquitoMissionsV2Preview';
    section.className = 'panel rounded-2xl p-5 sm:p-6 mb-6';
    section.dataset.previewOnly = 'true';
    section.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-3 mb-5"><div><p class="text-[10px] font-black uppercase tracking-[.18em] text-amber-300">Laboratorio seguro · sin guardar</p><h2 class="text-xl sm:text-2xl font-black mt-1">Misiones de Chabaquito V2</h2><p class="text-sm text-gray-400 mt-2 max-w-3xl">Diseña y valida una misión usando lugares reales de VisitaLoja. Esta pantalla no publica ni modifica campañas físicas.</p></div><span class="text-xs font-black rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200 px-3 py-1.5">PREVIEW LOCAL</span></div>
      <div class="grid xl:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)] gap-5">
        <form id="chabaquitoMissionPreviewForm" class="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
          <div class="grid sm:grid-cols-2 gap-4"><label class="block"><span class="text-sm font-bold block mb-2">ID interno</span><input id="cmv2Id" class="field font-mono" value="cafeterias_10" minlength="6" maxlength="64" pattern="[A-Za-z0-9_-]{6,64}" required></label><label class="block"><span class="text-sm font-bold block mb-2">Meta</span><input id="cmv2Target" class="field" type="number" min="1" max="500" value="10" required></label></div>
          <label class="block"><span class="text-sm font-bold block mb-2">Título</span><input id="cmv2Title" class="field" maxlength="100" value="Explorador cafetero" required></label>
          <label class="block"><span class="text-sm font-bold block mb-2">Descripción</span><textarea id="cmv2Description" class="field min-h-24" maxlength="500" required>Visita 10 cafeterías participantes y desbloquea una insignia especial.</textarea></label>
          <div class="grid sm:grid-cols-2 gap-4"><label class="block"><span class="text-sm font-bold block mb-2">Tipo de misión</span><select id="cmv2Type" class="field"><option value="category_visits">Visitas por categoría</option><option value="place_visits">Lugares específicos</option><option value="canton_visits">Cantones</option><option value="total_visits">Total de visitas</option></select></label><label class="block"><span class="text-sm font-bold block mb-2">Recompensa</span><select id="cmv2RewardType" class="field"><option value="digital">Solo digital</option><option value="digital_physical">Digital + física</option></select></label></div>
          <div id="cmv2ScopeWrap" class="space-y-2"><span id="cmv2ScopeLabel" class="text-sm font-bold block">Categorías participantes</span><div class="grid sm:grid-cols-[1fr_auto] gap-2"><select id="cmv2ScopeSelect" class="field"></select><button id="cmv2ScopeAdd" type="button" class="rounded-xl border border-white/15 px-4 font-bold hover:border-amber-400">Añadir</button></div><div id="cmv2ScopeSelected" class="flex flex-wrap gap-2"></div><p id="cmv2CatalogState" class="text-xs text-gray-500">Cargando catálogo real de VisitaLoja…</p></div>
          <div id="cmv2PhysicalWrap" class="hidden"><label class="block"><span class="text-sm font-bold block mb-2">ID campaña física existente</span><input id="cmv2PhysicalCampaign" class="field font-mono" placeholder="campana_fisica_01"></label></div>
          <div class="border-t border-white/10 pt-4"><p class="text-xs font-black uppercase tracking-widest text-violet-300 mb-3">Insignia digital</p><div class="grid sm:grid-cols-[90px_minmax(0,1fr)] gap-4"><label class="block"><span class="text-sm font-bold block mb-2">Icono</span><input id="cmv2BadgeIcon" class="field text-center text-xl" maxlength="16" value="☕"></label><label class="block"><span class="text-sm font-bold block mb-2">Nombre</span><input id="cmv2BadgeTitle" class="field" maxlength="80" value="Explorador Cafetero" required></label></div></div>
          <label class="block"><span class="text-sm font-bold block mb-2">Descripción de insignia</span><input id="cmv2BadgeDescription" class="field" maxlength="240" value="Completaste la ruta del café." required></label>
          <label class="block"><span class="text-sm font-bold block mb-2">Rareza</span><select id="cmv2BadgeRarity" class="field"><option value="common">Común</option><option value="uncommon">Poco común</option><option value="rare" selected>Rara</option><option value="epic">Épica</option><option value="legendary">Legendaria</option></select></label>
          <button type="submit" class="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black px-4 py-3"><i class="fa-solid fa-flask mr-2"></i>Validar misión</button><p id="cmv2State" class="text-sm text-gray-400" role="status" aria-live="polite">Nada de esta pantalla se guarda todavía.</p>
        </form>
        <div class="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5 h-fit"><p class="text-[10px] uppercase tracking-widest font-black text-emerald-300">Vista previa del logro</p><div class="mt-5 text-center"><div id="cmv2BadgeIconPreview" class="w-24 h-24 mx-auto rounded-full grid place-items-center text-5xl border border-amber-500/30 bg-amber-500/10">☕</div><h3 id="cmv2BadgeTitlePreview" class="font-black text-xl mt-4">Explorador Cafetero</h3><p id="cmv2BadgeDescriptionPreview" class="text-sm text-gray-400 mt-2">Completaste la ruta del café.</p><span id="cmv2BadgeRarityPreview" class="inline-flex mt-3 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200 text-xs font-black px-3 py-1">RARA</span></div><div class="mt-6 rounded-xl border border-white/10 p-4"><div class="flex justify-between text-xs font-bold mb-2"><span>Ejemplo de progreso</span><span id="cmv2ProgressText">0 / 10</span></div><div class="h-2 rounded-full bg-white/10 overflow-hidden"><div class="h-full bg-emerald-400" style="width:0%"></div></div></div><p class="text-xs text-amber-200 mt-4"><i class="fa-solid fa-shield-halved mr-1"></i>El progreso real se calculará después con visitas/check-ins válidos; no con botones manuales.</p></div>
      </div>`;
    adminContent.prepend(section);

    const $ = id => document.getElementById(id);
    const scopeMap = { category_visits:['Categorías participantes','categoryIds'], place_visits:['Lugares participantes','placeIds'], canton_visits:['Cantones participantes','cantonIds'], total_visits:['Sin filtro específico',null] };
    let places = [];
    let selected = [];

    const text = value => String(value ?? '').trim();
    const placeTitle = p => text(p.title || p.name || p.nombre || p.id) || p.id;
    const placeCategory = p => text(p.category || p.categoria || p.type || p.tipo);
    const placeCanton = p => text(p.canton || p.city || p.ciudad || p.municipality);
    const uniqueOptions = (items, valueFn, labelFn = valueFn) => {
      const map = new Map(); items.forEach(item => { const value=text(valueFn(item)); if(value&&!map.has(value))map.set(value,text(labelFn(item))||value); });
      return [...map].map(([value,label])=>({value,label})).sort((a,b)=>a.label.localeCompare(b.label,'es'));
    };
    function optionsFor(type) {
      if (type === 'category_visits') return uniqueOptions(places, placeCategory);
      if (type === 'place_visits') return uniqueOptions(places, p=>p.id, placeTitle);
      if (type === 'canton_visits') return uniqueOptions(places, placeCanton);
      return [];
    }
    function renderSelected() {
      const box=$('cmv2ScopeSelected'); box.replaceChildren();
      selected.forEach(item=>{const chip=document.createElement('button');chip.type='button';chip.className='rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-100 text-xs font-bold px-3 py-1.5';chip.textContent=`${item.label} ×`;chip.title='Quitar';chip.addEventListener('click',()=>{selected=selected.filter(x=>x.value!==item.value);renderSelected();});box.append(chip);});
    }
    function renderCatalog() {
      const type=$('cmv2Type').value, [,key]=scopeMap[type], select=$('cmv2ScopeSelect');
      $('cmv2ScopeLabel').textContent=scopeMap[type][0];
      $('cmv2ScopeWrap').classList.toggle('hidden',!key);
      selected=[]; renderSelected(); select.replaceChildren();
      if(!key)return;
      const opts=optionsFor(type); const first=document.createElement('option');first.value='';first.textContent=opts.length?'Selecciona una opción…':'No hay opciones disponibles';select.append(first);
      opts.forEach(item=>{const option=document.createElement('option');option.value=item.value;option.textContent=item.label;select.append(option);});
      $('cmv2CatalogState').textContent=places.length?`${places.length} lugares leídos · ${opts.length} opciones disponibles. No se modificó Firestore.`:'No se pudo cargar el catálogo; no se habilitan IDs manuales para evitar errores.';
    }
    async function loadCatalog() {
      try {
        if (typeof db === 'undefined') throw new Error('Firestore no disponible');
        const snap=await db.collection('locales').get();
        places=snap.docs.map(doc=>({id:doc.id,...doc.data()}));
        renderCatalog();
      } catch(error) {
        places=[]; renderCatalog(); $('cmv2CatalogState').textContent='No se pudo leer locales. Esta pantalla sigue sin guardar datos.';
      }
    }
    function syncFields() {
      $('cmv2PhysicalWrap').classList.toggle('hidden',$('cmv2RewardType').value!=='digital_physical');
      $('cmv2PhysicalCampaign').required=$('cmv2RewardType').value==='digital_physical';
      $('cmv2BadgeIconPreview').textContent=$('cmv2BadgeIcon').value||'🏅'; $('cmv2BadgeTitlePreview').textContent=$('cmv2BadgeTitle').value||'Insignia'; $('cmv2BadgeDescriptionPreview').textContent=$('cmv2BadgeDescription').value||'Recompensa digital'; $('cmv2BadgeRarityPreview').textContent=$('cmv2BadgeRarity').selectedOptions[0].textContent.toUpperCase(); $('cmv2ProgressText').textContent=`0 / ${$('cmv2Target').value||0}`;
    }
    $('cmv2ScopeAdd').addEventListener('click',()=>{const select=$('cmv2ScopeSelect'),value=select.value;if(!value||selected.some(x=>x.value===value))return;selected.push({value,label:select.selectedOptions[0].textContent});renderSelected();select.value='';});
    $('cmv2Type').addEventListener('change',()=>{renderCatalog();syncFields();}); section.addEventListener('input',syncFields); section.addEventListener('change',syncFields);
    $('chabaquitoMissionPreviewForm').addEventListener('submit',event=>{event.preventDefault();const type=$('cmv2Type').value,[,scopeKey]=scopeMap[type];const payload={id:$('cmv2Id').value,title:$('cmv2Title').value,description:$('cmv2Description').value,type,targetCount:$('cmv2Target').value,rewardType:$('cmv2RewardType').value,physicalCampaignId:$('cmv2PhysicalCampaign').value,status:'draft',badge:{title:$('cmv2BadgeTitle').value,description:$('cmv2BadgeDescription').value,icon:$('cmv2BadgeIcon').value,rarity:$('cmv2BadgeRarity').value}};if(scopeKey)payload[scopeKey]=selected.map(x=>x.value);try{const mission=model.normalizeMission(payload);$('cmv2State').textContent=`✓ Misión válida: ${mission.title}. Meta ${mission.targetCount}. Aún NO se ha guardado.`;$('cmv2State').className='text-sm text-emerald-300';}catch(error){$('cmv2State').textContent=`No válida: ${error.message}`;$('cmv2State').className='text-sm text-red-300';}});
    syncFields(); loadCatalog();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
