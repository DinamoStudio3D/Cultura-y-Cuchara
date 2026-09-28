/* Interfaz administrativa de QR dinámicos. Se monta junto al gestor estático sin alterar sus funciones. */
(() => {
  'use strict';

  // Carga temporal y aislada del laboratorio de Misiones V2 desde un script que
  // ya forma parte del Admin Preview. No escribe Firestore ni modifica admin.html.
  function loadPreviewScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.append(script);
    });
  }
  (async () => {
    try {
      if (!window.visitaLojaChabaquitoMissionsV2) await loadPreviewScript('js/chabaquito-missions-v2-model.js');
      await loadPreviewScript('js/admin-chabaquito-missions-v2-preview.js');
    } catch (error) {
      console.warn('Misiones de Chabaquito V2 Preview no pudo cargarse:', error);
    }
  })();

  const store = window.visitaLojaDynamicQrStore;
  const staticQr = window.visitaLojaStaticQr;
  const staticRoot = document.getElementById('staticQrCreatePanel')?.parentElement;
  if (!store || !staticRoot || document.getElementById('dynamicQrPanel')) return;

  const panel = document.createElement('section');
  panel.id = 'dynamicQrPanel';
  panel.className = 'mt-8 border-t border-white/10 pt-7';
  panel.innerHTML = `
    <div class="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div><p class="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">QR permanente</p><h3 class="text-xl font-black text-white mt-1">QR dinámicos</h3><p class="text-sm text-gray-400 mt-1 max-w-2xl">Imprime una sola vez. Después puedes cambiar el destino sin cambiar la dirección permanente del QR.</p></div>
      <span class="text-xs font-bold rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-3 py-1.5">Beta · Preview</span>
    </div>
    <div class="grid xl:grid-cols-2 gap-5">
      <form id="dynamicQrForm" class="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5 space-y-4">
        <label class="block"><span class="text-sm font-bold block mb-2">Nombre interno</span><input id="dynamicQrName" class="field" maxlength="80" placeholder="Ej. Afiche Terminal Terrestre" required></label>
        <label class="block"><span class="text-sm font-bold block mb-2">Destino actual</span><input id="dynamicQrDestination" class="field" type="url" inputmode="url" maxlength="1800" placeholder="https://www.visitaloja.com/..." required></label>
        <div><span class="text-sm font-bold block mb-2">ID permanente</span><div class="flex gap-2"><input id="dynamicQrId" class="field font-mono" minlength="6" maxlength="64" pattern="[A-Za-z0-9_-]{6,64}" required><button id="dynamicQrGenerateId" type="button" class="rounded-xl border border-white/15 px-3 font-bold hover:border-amber-400">Generar</button></div><p class="text-xs text-amber-200 mt-2">Este ID queda ligado a las impresiones físicas y no podrá editarse después de crear el QR.</p></div>
        <div id="dynamicQrPermanentBox" class="hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><p class="text-[10px] uppercase tracking-widest font-black text-emerald-300">URL permanente</p><p id="dynamicQrPermanentUrl" class="text-sm break-all mt-1 font-mono"></p></div>
        <div class="flex flex-wrap gap-2"><button id="dynamicQrCreate" type="submit" class="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black px-4 py-3"><i class="fa-solid fa-qrcode mr-2"></i>Crear QR dinámico</button><button id="dynamicQrCancelEdit" type="button" class="hidden rounded-xl border border-white/15 px-4 py-3 font-bold">Cancelar edición</button></div>
        <p id="dynamicQrState" class="text-sm text-gray-400" role="status" aria-live="polite">Las reglas aún deben publicarse antes de guardar datos reales.</p>
      </form>
      <div class="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
        <div class="flex items-center justify-between gap-3 mb-4"><div><h4 class="font-black">Mis QR dinámicos</h4><p id="dynamicQrCount" class="text-xs text-gray-400">0 registros</p></div><button id="dynamicQrRefresh" type="button" class="rounded-xl border border-white/15 px-3 py-2 text-sm font-bold">Actualizar</button></div>
        <div id="dynamicQrList" class="space-y-3"><p class="text-sm text-gray-500">Aún no se han cargado registros.</p></div>
      </div>
    </div>`;
  staticRoot.append(panel);

  const $ = id => document.getElementById(id);
  let records = [];
  let editingId = null;
  let unsubscribe = null;
  const collection = db.collection(store.collections.private);

  function state(text, error = false) { $('dynamicQrState').textContent = text; $('dynamicQrState').className = `text-sm ${error ? 'text-red-300' : 'text-gray-400'}`; }
  function randomId() { const bytes = new Uint8Array(9); crypto.getRandomValues(bytes); return Array.from(bytes, b => b.toString(36).padStart(2,'0')).join('').slice(0,12); }
  function setId() { if (!editingId) $('dynamicQrId').value = randomId(); previewUrl(); }
  function previewUrl() { try { $('dynamicQrPermanentUrl').textContent = store.publicUrl($('dynamicQrId').value); $('dynamicQrPermanentBox').classList.remove('hidden'); } catch (_) { $('dynamicQrPermanentBox').classList.add('hidden'); } }
  function reset() { editingId = null; $('dynamicQrForm').reset(); $('dynamicQrId').disabled = false; $('dynamicQrGenerateId').disabled = false; $('dynamicQrCreate').innerHTML = '<i class="fa-solid fa-qrcode mr-2"></i>Crear QR dinámico'; $('dynamicQrCancelEdit').classList.add('hidden'); setId(); state('Listo para crear un QR dinámico.'); }
  function safeText(value) { return String(value ?? ''); }
  async function prepareDownload(record, format) {
    if (!staticQr) return state('El generador QR verificado no está disponible. Recarga el administrador.', true);
    const permanentUrl = store.publicUrl(record.id);
    state(`Preparando ${format.toUpperCase()} del enlace permanente…`);
    try {
      const loaded = await staticQr.loadSaved({
        url: permanentUrl,
        name: record.name || `QR dinámico ${record.id}`,
        config: { margin: 4, level: 'H', size: 2048, logoEnabled: true, logoSize: 18 }
      });
      if (!loaded) throw new Error('No se pudo verificar la vista previa.');
      await staticQr.download(format);
      state(`${format.toUpperCase()} preparado con la URL permanente. Cambiar el destino después no cambia esta impresión.`);
    } catch (error) {
      state(`No se pudo preparar el ${format.toUpperCase()} (${error.message || 'error'}).`, true);
    }
  }
  function render() {
    $('dynamicQrCount').textContent = `${records.length} registro${records.length === 1 ? '' : 's'}`;
    const list = $('dynamicQrList'); list.replaceChildren();
    if (!records.length) { const p=document.createElement('p');p.className='text-sm text-gray-500';p.textContent='Todavía no hay QR dinámicos.';list.append(p);return; }
    records.slice().sort((a,b)=>(b.updatedAt?.toMillis?.()||0)-(a.updatedAt?.toMillis?.()||0)).forEach(r => {
      const card=document.createElement('article');card.className='rounded-xl border border-white/10 bg-white/[.03] p-3';
      const head=document.createElement('div');head.className='flex flex-wrap justify-between gap-2';
      const info=document.createElement('div');info.className='min-w-0';
      const h=document.createElement('h5');h.className='font-black';h.textContent=safeText(r.name)||'Sin nombre';
      const permanent=document.createElement('p');permanent.className='text-xs text-emerald-300 break-all mt-1';permanent.textContent=store.publicUrl(r.id);
      const dest=document.createElement('p');dest.className='text-xs text-gray-400 break-all mt-1';dest.textContent=`Destino: ${safeText(r.destinationUrl)}`;
      info.append(h,permanent,dest);
      const badge=document.createElement('span');badge.className=`h-fit text-[11px] font-black rounded-full px-2.5 py-1 ${r.status==='active'?'bg-emerald-500/15 text-emerald-200':'bg-gray-700 text-gray-300'}`;badge.textContent=r.status==='active'?'ACTIVO':'INACTIVO';head.append(info,badge);card.append(head);
      const actions=document.createElement('div');actions.className='flex flex-wrap gap-2 mt-3';
      [['Editar destino','edit'],[r.status==='active'?'Desactivar':'Activar','toggle'],['Descargar PNG','png'],['Descargar SVG','svg'],['Abrir permanente','open'],['Copiar URL','copy']].forEach(([label,action])=>{const b=document.createElement('button');b.type='button';b.className='text-xs font-bold rounded-lg border border-white/15 px-3 py-2 hover:border-amber-400';b.textContent=label;b.dataset.action=action;b.dataset.id=r.id;actions.append(b);});
      card.append(actions);list.append(card);
    });
  }
  function listen() {
    if (unsubscribe || !auth.currentUser) return;
    unsubscribe = collection.onSnapshot(s => { records=s.docs.map(d=>({id:d.id,...d.data()}));render(); }, e => { state(e.code==='permission-denied'?'Las reglas de QR dinámicos todavía no están publicadas.':'No se pudieron cargar los QR dinámicos.',true); });
  }
  $('dynamicQrGenerateId').addEventListener('click', setId);
  $('dynamicQrId').addEventListener('input', previewUrl);
  $('dynamicQrCancelEdit').addEventListener('click', reset);
  $('dynamicQrRefresh').addEventListener('click', () => { if(unsubscribe){unsubscribe();unsubscribe=null;} listen(); });
  $('dynamicQrForm').addEventListener('submit', async e => {
    e.preventDefault(); if (!auth.currentUser) return state('Inicia sesión como administrador.',true);
    const button=$('dynamicQrCreate');button.disabled=true;
    try {
      if (editingId) {
        if (!confirm('Cambiarás el destino de un QR que puede estar impreso. La URL permanente NO cambiará. ¿Continuar?')) return;
        await store.update(editingId,{name:$('dynamicQrName').value,destinationUrl:$('dynamicQrDestination').value});
        reset();
        state('Destino actualizado. Las impresiones existentes usarán el nuevo destino.');
      } else {
        const result=await store.create({qrId:$('dynamicQrId').value,name:$('dynamicQrName').value,destinationUrl:$('dynamicQrDestination').value,destinationType:'manual',status:'active',config:{}});
        reset();
        state(`QR creado correctamente. URL permanente: ${result.publicUrl}`);
      }
      listen();
    } catch(err) { state(err.code==='permission-denied'?'Firestore rechazó la operación: faltan las reglas de QR dinámicos.':`No se pudo guardar (${err.message || 'error'}).`,true); }
    finally { button.disabled=false; }
  });
  $('dynamicQrList').addEventListener('click', async e => {
    const b=e.target.closest('button[data-action]');if(!b)return;const r=records.find(x=>x.id===b.dataset.id);if(!r)return;
    if(b.dataset.action==='open') window.open(store.publicUrl(r.id),'_blank','noopener,noreferrer');
    if(b.dataset.action==='copy'){try{await navigator.clipboard.writeText(store.publicUrl(r.id));state('URL permanente copiada.');}catch(_){state('No se pudo copiar la URL automáticamente.',true);}}
    if(b.dataset.action==='png' || b.dataset.action==='svg') await prepareDownload(r,b.dataset.action);
    if(b.dataset.action==='edit'){editingId=r.id;$('dynamicQrName').value=r.name||'';$('dynamicQrDestination').value=r.destinationUrl||'';$('dynamicQrId').value=r.id;$('dynamicQrId').disabled=true;$('dynamicQrGenerateId').disabled=true;previewUrl();$('dynamicQrCreate').textContent='Guardar nuevo destino';$('dynamicQrCancelEdit').classList.remove('hidden');state('El ID permanente está bloqueado. Solo cambiarán nombre/destino.');$('dynamicQrName').focus();}
    if(b.dataset.action==='toggle'){const active=r.status!=='active';if(!confirm(`${active?'Activar':'Desactivar'} “${r.name}”? El QR impreso conservará su URL permanente.`))return;try{await store.setActive(r.id,active);state(active?'QR activado.':'QR desactivado; las impresiones no se han eliminado.');}catch(err){state(err.code==='permission-denied'?'Faltan las reglas de QR dinámicos.':'No se pudo cambiar el estado.',true);}}
  });
  auth.onAuthStateChanged(user=>{if(!user){if(unsubscribe){unsubscribe();unsubscribe=null;}records=[];render();}else listen();});
  setId();
})();
