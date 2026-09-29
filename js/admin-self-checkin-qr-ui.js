(function (global) {
  'use strict';

  const qrApi = global.VisitaLojaSelfCheckinQr;
  const modeApi = global.VisitaLojaVisitValidationAdminIntegration;
  if (!qrApi || !modeApi || document.getElementById('selfCheckinQrAdminCard')) return;

  const $ = id => document.getElementById(id);
  let currentPlaceId = '';
  let lastUrl = '';

  function actor() {
    const user = global.auth?.currentUser || global.firebase?.auth?.().currentUser;
    return { actorUid: user?.uid || '', actorEmail: user?.email || '' };
  }

  function firestore() {
    if (global.db) return global.db;
    if (global.firebase?.firestore) return global.firebase.firestore();
    throw new Error('Firestore no está disponible.');
  }

  function card() {
    const field = $('placeValidationModeField');
    if (!field) return null;
    const node = document.createElement('div');
    node.id = 'selfCheckinQrAdminCard';
    node.className = 'hidden sm:col-span-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 mt-3';
    node.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><p class="text-[10px] font-black uppercase tracking-widest text-emerald-300">Visita autónoma</p><h4 class="font-black mt-1">QR para lugar sin encargado</h4><p class="text-xs text-gray-400 mt-1 max-w-2xl">Genera un QR exclusivo para este atractivo. El visitante inicia sesión, el servidor valida el código y registra Pasaporte + Misiones sin otorgar fidelidad comercial.</p></div>
        <span id="selfCheckinQrStatus" class="text-[10px] font-black rounded-full border border-gray-700 text-gray-300 px-2.5 py-1">SIN GENERAR</span>
      </div>
      <div class="flex flex-wrap gap-2 mt-4">
        <button id="selfCheckinQrGenerate" type="button" class="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black px-4 py-2.5"><i class="fa-solid fa-qrcode mr-2"></i>Generar QR de visita</button>
        <button id="selfCheckinQrRotate" type="button" class="hidden rounded-xl border border-amber-500/35 text-amber-200 px-4 py-2.5 font-bold"><i class="fa-solid fa-rotate mr-2"></i>Regenerar QR</button>
        <button id="selfCheckinQrDownload" type="button" class="hidden rounded-xl border border-cyan-500/35 text-cyan-200 px-4 py-2.5 font-bold"><i class="fa-solid fa-download mr-2"></i>Descargar PNG</button>
        <button id="selfCheckinQrDeactivate" type="button" class="hidden rounded-xl border border-red-500/35 text-red-300 px-4 py-2.5 font-bold">Desactivar</button>
      </div>
      <div id="selfCheckinQrPreviewWrap" class="hidden mt-4 grid md:grid-cols-[180px_minmax(0,1fr)] gap-4 items-center">
        <div id="selfCheckinQrPreview" class="bg-white rounded-xl p-3 w-[180px] min-h-[180px]"></div>
        <div><p class="text-xs font-black text-emerald-300 mb-1">URL codificada</p><p id="selfCheckinQrUrl" class="text-xs text-gray-400 break-all font-mono"></p><p class="text-xs text-amber-200 mt-3"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Regenerar invalida inmediatamente el QR anterior. Hazlo solo si el código físico se perdió o fue comprometido.</p></div>
      </div>
      <p id="selfCheckinQrMessage" class="text-xs text-gray-400 mt-3" role="status" aria-live="polite"></p>`;
    field.insertAdjacentElement('afterend', node);
    return node;
  }

  function placeId() {
    return currentPlaceId || String($('placeId')?.value || $('placeForm')?.dataset?.placeId || '').trim();
  }

  function renderMode() {
    const node = $('selfCheckinQrAdminCard') || card();
    if (!node) return;
    node.classList.toggle('hidden', modeApi.getMode() !== 'self_checkin');
  }

  function message(text, error) {
    const node = $('selfCheckinQrMessage');
    if (!node) return;
    node.textContent = text || '';
    node.className = `text-xs mt-3 ${error ? 'text-red-300' : 'text-gray-400'}`;
  }

  function showUrl(url) {
    lastUrl = url;
    $('selfCheckinQrUrl').textContent = url;
    $('selfCheckinQrPreviewWrap').classList.remove('hidden');
    $('selfCheckinQrRotate').classList.remove('hidden');
    $('selfCheckinQrDownload').classList.remove('hidden');
    $('selfCheckinQrDeactivate').classList.remove('hidden');
    $('selfCheckinQrGenerate').classList.add('hidden');
    const status = $('selfCheckinQrStatus'); status.textContent = 'ACTIVO'; status.className = 'text-[10px] font-black rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-2.5 py-1';
    const preview = $('selfCheckinQrPreview'); preview.replaceChildren();
    if (global.QRCode) new global.QRCode(preview, { text: url, width: 156, height: 156, correctLevel: global.QRCode.CorrectLevel?.M });
    else preview.textContent = 'QR listo. Recarga si no aparece la vista previa.';
  }

  async function generate(rotating) {
    const id = placeId();
    if (!id) return message('Primero guarda la parada para obtener su ID y luego genera el QR.', true);
    if (rotating && !confirm('El QR anterior dejará de funcionar inmediatamente. ¿Regenerarlo?')) return;
    message(rotating ? 'Regenerando QR…' : 'Generando QR seguro…');
    try {
      const result = await qrApi.createOrRotate({ db: firestore(), placeId: id, ...actor() });
      showUrl(result.url);
      message(rotating ? 'QR regenerado. Sustituye cualquier impresión anterior.' : 'QR generado correctamente. Ya puedes descargarlo e imprimirlo.');
    } catch (error) { message(error?.code === 'permission-denied' ? 'Firestore rechazó la operación. Las reglas privadas de self-check-in todavía deben publicarse.' : (error?.message || 'No se pudo generar el QR.'), true); }
  }

  async function deactivate() {
    const id = placeId(); if (!id) return;
    if (!confirm('¿Desactivar este QR? Las impresiones dejarán de registrar visitas hasta generar uno nuevo.')) return;
    try {
      await qrApi.deactivate({ db: firestore(), placeId: id, ...actor() });
      lastUrl = ''; $('selfCheckinQrPreviewWrap').classList.add('hidden'); $('selfCheckinQrRotate').classList.add('hidden'); $('selfCheckinQrDownload').classList.add('hidden'); $('selfCheckinQrDeactivate').classList.add('hidden'); $('selfCheckinQrGenerate').classList.remove('hidden');
      const status=$('selfCheckinQrStatus');status.textContent='INACTIVO';status.className='text-[10px] font-black rounded-full border border-gray-700 text-gray-300 px-2.5 py-1'; message('QR desactivado.');
    } catch (error) { message(error?.message || 'No se pudo desactivar el QR.', true); }
  }

  function download() {
    const canvas = $('selfCheckinQrPreview')?.querySelector('canvas');
    const image = $('selfCheckinQrPreview')?.querySelector('img');
    const href = canvas?.toDataURL('image/png') || image?.src;
    if (!href || !lastUrl) return message('Primero genera el QR.', true);
    const a=document.createElement('a');a.href=href;a.download=`visitaloja-self-checkin-${placeId()}.png`;a.click();
  }

  function bind() {
    const node = card(); if (!node) return;
    $('placeValidationMode')?.addEventListener('change', renderMode);
    $('selfCheckinQrGenerate').addEventListener('click',()=>generate(false));
    $('selfCheckinQrRotate').addEventListener('click',()=>generate(true));
    $('selfCheckinQrDownload').addEventListener('click',download);
    $('selfCheckinQrDeactivate').addEventListener('click',deactivate);
    renderMode();
  }

  global.VisitaLojaSelfCheckinQrUi = Object.freeze({
    setPlace(place) { currentPlaceId=String(place?.id||'').trim(); renderMode(); },
    clearPlace() { currentPlaceId=''; lastUrl=''; renderMode(); },
    renderMode
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})(window);
