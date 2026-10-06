/* Campos progresivos de Paradas. No inicializa Firebase ni genera QR. */
(function () {
  'use strict';
  const api = window.ChabaquitoPlaceConfig;
  let original = {};
  const $ = id => document.getElementById(id);
  function ensure() {
    const form = $('placeForm');
    if (!form || $('chabaquitoPlaceFields')) return;
    const section = document.createElement('fieldset');
    section.id = 'chabaquitoPlaceFields'; section.className = 'border border-amber-500/25 rounded-xl p-4 space-y-3';
    section.innerHTML = `<legend class="font-bold text-amber-300">Chabaquito · preparación de parada</legend>
      <p class="text-xs text-gray-400">Configuración para una activación futura. No inicia el sistema de XP.</p>
      <label class="flex gap-2"><input type="checkbox" id="chabaquitoPlaceEnabled">Preparada para participar (requiere validación completa)</label>
      <div class="grid sm:grid-cols-2 gap-3">
      <label>Cantón<select id="chabaquitoPlaceCanton" class="field"><option value="">Seleccionar</option></select></label>
      <label>Método<select id="chabaquitoPlaceMethod" class="field"><option value="manager">Encargado</option><option value="proximity">Proximidad</option><option value="both">Ambos</option></select></label>
      <label class="sm:col-span-2">QR turístico de esta parada<select id="chabaquitoPlaceQr" class="field"><option value="">Seleccionar QR existente…</option></select><small class="block mt-1 text-xs text-gray-500">Sirve para comprobar qué parada visitó el turista. No es el ID de una misión.</small></label></div>
      <label class="flex gap-2 text-sm"><input type="checkbox" id="chabaquitoPlaceAssociate">Preparar asociación explícita del QR existente a esta parada</label>
      <p class="text-xs text-gray-400">Usa las coordenadas del formulario y los encargados ya asignados. No cambia el destino ni el diseño del QR.</p>
      <button id="chabaquitoPlaceCheck" type="button" class="border border-amber-400/40 rounded-xl px-3 py-2">Comprobar configuración</button>
      <p id="chabaquitoPlaceState" class="text-sm text-gray-400" role="status" aria-live="polite">No comprobada.</p>`;
    for (const canton of api.CANTONS) { const option = document.createElement('option'); option.value = canton.id; option.textContent = canton.name; section.querySelector('#chabaquitoPlaceCanton').append(option); }
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.before(section); else form.append(section);
    section.addEventListener('change', () => { $('chabaquitoPlaceState').textContent = 'Cambios pendientes de comprobar y guardar.'; if (typeof setAdminUnsavedChanges === 'function') setAdminUnsavedChanges(true); });
    $('chabaquitoPlaceCheck').addEventListener('click', async () => {
      try { const result = await prepare($('placeEditId').value, { active: original.active, publicationStatus: $('placePublicationStatus').value, lat: $('placeLat').value.trim() ? Number($('placeLat').value) : NaN, lng: $('placeLng').value.trim() ? Number($('placeLng').value) : NaN }, true); $('chabaquitoPlaceState').textContent = result.readiness.ready ? 'Configuración completa. Aún no se ha guardado.' : result.readiness.issues.join(' '); }
      catch (error) { $('chabaquitoPlaceState').textContent = error.message; }
    });
  }
  async function load(place = {}) {
    ensure(); original = place;
    const qrSelect = $('chabaquitoPlaceQr');
    if (qrSelect) {
      const selected = place.discovery?.qrId || '';
      let docs = [];
      try { const snap = await db.collection('qrCodes').get(); docs = snap.docs.map(d => ({ id: d.id, ...d.data() })); } catch (_) {}
      qrSelect.innerHTML = '<option value="">Seleccionar QR existente…</option>' + docs.map(q => `<option value="${String(q.id).replace(/"/g,'&quot;')}">${String(q.name || q.title || q.label || q.id).replace(/</g,'&lt;')} — ${String(q.id).replace(/</g,'&lt;')}</option>`).join('');
      if (selected && !docs.some(q => q.id === selected)) qrSelect.insertAdjacentHTML('beforeend', `<option value="${selected}">${selected} (asociado actualmente)</option>`);
      qrSelect.value = selected;
    }
    $('chabaquitoPlaceEnabled').checked = place.discovery?.enabled === true;
    $('chabaquitoPlaceCanton').value = place.cantonId || '';
    $('chabaquitoPlaceMethod').value = api.methodFor(place) || 'manager';
    $('chabaquitoPlaceAssociate').checked = false;
    $('chabaquitoPlaceState').textContent = 'No comprobada. No se habilita automáticamente.';
  }
  async function prepare(placeId, place, checkOnly = false) {
    ensure();
    const discovery = { ...original.discovery, enabled: $('chabaquitoPlaceEnabled').checked, method: $('chabaquitoPlaceMethod').value, qrId: $('chabaquitoPlaceQr').value.trim(), version: 1 };
    const patch = { cantonId: $('chabaquitoPlaceCanton').value, discovery };
    if (!discovery.enabled && !checkOnly) return { patch, qrPatch: null };
    if (!placeId) throw new Error('Guarda primero la parada; después configura Chabaquito.');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(discovery.qrId)) throw new Error('Selecciona un ID de QR existente válido.');
    const qrSnap = await db.collection('qrCodes').doc(discovery.qrId).get();
    const merchantsSnap = await db.collection('missionRewardMerchants').where('placeIds','array-contains',placeId).get();
    if (!qrSnap.exists) throw new Error('El QR no existe. Utiliza el generador actual.');
    let qr = { ...qrSnap.data(), id: qrSnap.id }, qrPatch = null;
    if ($('chabaquitoPlaceAssociate').checked) {
      if (qr.placeId && qr.placeId !== placeId) throw new Error('Ese QR pertenece a otra parada.');
      qrPatch = { placeId, active: true, discoveryEnabled: true }; qr = { ...qr, ...qrPatch };
    }
    const readiness = api.readiness({ placeId, place: { ...original, ...place, ...patch }, qr, merchants: merchantsSnap.docs.map(d => d.data()) });
    if (!checkOnly && discovery.enabled && !readiness.ready) throw new Error(readiness.issues.join(' '));
    return { patch, qrPatch, readiness };
  }
  window.ChabaquitoPlaceAdmin = Object.freeze({ load, prepare });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => load()); else load();
})();
