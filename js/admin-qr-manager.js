/* Gestión de QR estáticos de difusión; separada de qrCodes y de los QR de visitas. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const bridge = window.visitaLojaStaticQr;
  if (!bridge || !$('staticQrSave')) return;
  const collection = db.collection('staticMarketingQrs');
  const timestamp = () => firebase.firestore.FieldValue.serverTimestamp();
  const types = { manual: 'URL personalizada', home: 'Inicio', place: 'Negocio o parada',
    routes: 'Rutas', passport: 'Pasaporte', agenda: 'Agenda', shop: 'Tienda', signup: 'Sumar negocio' };
  let records = [];
  let unsubscribe = null;
  let editing = null;
  let busy = false;
  let loading = false;

  function textNode(tag, className, value) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = String(value ?? '');
    return node;
  }
  function state(value, error = false) {
    const node = $('staticQrSaveState');
    node.textContent = value;
    node.className = `text-xs mt-2 ${error ? 'text-red-700' : 'text-gray-600'}`;
  }
  function listState(value, error = false) {
    const node = $('staticQrListState');
    node.textContent = value;
    node.className = `text-sm mb-3 ${error ? 'text-red-300' : 'text-gray-400'}`;
  }
  function authorizedUi() {
    return Boolean(auth.currentUser && !adminView.classList.contains('hidden'));
  }
  function syncSave() {
    $('staticQrSave').disabled = busy || !authorizedUi() || !bridge.snapshot();
    if (authorizedUi() && $('staticQrSaveState').textContent === 'Inicia sesión como administrador para guardar.')
      state('Escribe un nombre para guardar este QR.');
    $('staticQrSave').lastChild.textContent = editing ? 'Guardar cambios' : 'Guardar QR';
    const warn = $('staticQrEditWarning');
    const changed = Boolean(editing && bridge.snapshot() && bridge.snapshot().url !== editing.url);
    warn.classList.toggle('hidden', !changed);
    warn.textContent = changed ? 'Cambiar la URL crea un QR distinto. Los códigos ya impresos seguirán abriendo el destino anterior.' : '';
  }
  function currentName() {
    const name = $('staticQrName').value.trim();
    if (!name || name.length > 80) throw new Error('Escribe un nombre de hasta 80 caracteres para guardar el QR.');
    return name;
  }
  function recordData(snapshot, name, user, original = null) {
    const sameUrl = original && snapshot.url === original.url;
    return {
      name, url: bridge.validateUrl(snapshot.url),
      destinationType: sameUrl && snapshot.destinationType === 'manual' ? original.destinationType : snapshot.destinationType,
      placeId: sameUrl && snapshot.destinationType === 'manual' ? original.placeId || '' : snapshot.placeId || '',
      config: { ...snapshot.config }, status: 'saved', updatedAt: timestamp(), updatedByUid: user.uid
    };
  }
  function createdData(data, user) {
    return { ...data, createdAt: timestamp(), createdByUid: user.uid,
      createdByEmail: user.email || '' };
  }
  function switchTab(tab) {
    const saved = tab === 'saved';
    $('staticQrCreatePanel').classList.toggle('hidden', saved);
    $('staticQrSavedPanel').classList.toggle('hidden', !saved);
    for (const [id, active] of [['staticQrCreateTab', !saved], ['staticQrSavedTab', saved]]) {
      $(id).classList.toggle('is-active', active);
      $(id).setAttribute('aria-selected', String(active));
    }
    if (saved) listen();
  }
  function listen() {
    if (unsubscribe || loading) return;
    if (!authorizedUi()) { listState('Inicia sesión como administrador para consultar tus QR.', true); return; }
    loading = true;
    listState('Cargando códigos guardados…');
    unsubscribe = collection.onSnapshot(snapshot => {
      loading = false;
      records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderList();
    }, error => {
      loading = false; unsubscribe = null;
      listState(error.code === 'permission-denied'
        ? 'Firestore aún no permite leer estos QR. Falta publicar la regla de staticMarketingQrs.'
        : 'No se pudieron cargar los QR. Comprueba la conexión.', true);
    });
  }
  function validRecord(record) {
    try { return bridge.validateUrl(record.url) === record.url; } catch (_) { return false; }
  }
  function dateLabel(record) {
    const date = record.updatedAt?.toDate?.() || record.createdAt?.toDate?.();
    return date ? date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Fecha pendiente';
  }
  function thumbnail(record) {
    const image = document.createElement('img');
    image.className = 'static-qr-thumb';
    image.alt = `Miniatura QR: ${record.name || 'sin nombre'}`;
    image.width = image.height = 94;
    try {
      if (!validRecord(record)) throw new Error('URL inválida');
      const code = qrcode(0, record.config?.level || 'M');
      code.addData(record.url, 'Byte'); code.make();
      image.src = code.createDataURL(3, 12);
    } catch (_) { image.alt = 'QR no disponible'; }
    return image;
  }
  function action(label, type, id) {
    const button = textNode('button', 'static-qr-action', label);
    button.type = 'button'; button.dataset.qrAction = type; button.dataset.qrId = id;
    return button;
  }
  function renderList() {
    const search = $('staticQrSearch').value.trim().toLocaleLowerCase('es');
    const filter = $('staticQrFilter').value;
    const sorted = records.slice().sort((a,b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
    const shown = sorted.filter(record => (!filter || record.destinationType === filter)
      && (!search || `${record.name || ''} ${record.url || ''}`.toLocaleLowerCase('es').includes(search)));
    $('staticQrSavedCount').textContent = `${records.length} guardados`;
    const list = $('staticQrSavedList'); list.replaceChildren();
    for (const record of shown) {
      const card = document.createElement('article'); card.className = 'static-qr-card';
      card.append(thumbnail(record));
      const detail = document.createElement('div'); detail.className = 'min-w-0';
      detail.append(textNode('h4', 'font-black text-white truncate', record.name || 'Sin nombre'),
        textNode('p', 'text-xs text-gray-400 break-all mt-1', record.url || 'Sin destino'),
        textNode('p', 'text-xs text-amber-200 mt-2', `${types[record.destinationType] || 'Destino'} · ${dateLabel(record)} · ${validRecord(record) ? 'Guardado' : 'URL inválida'}${record.config?.logoEnabled ? ' · Logo' : ''}`));
      card.append(detail);
      const controls = document.createElement('div'); controls.className = 'static-qr-card-actions';
      for (const [label,type] of [['Ver / abrir','open'],['PNG','png'],['SVG','svg'],['Editar','edit'],['Duplicar','duplicate'],['Eliminar','delete']])
        controls.append(action(label,type,record.id));
      card.append(controls); list.append(card);
    }
    listState(shown.length ? `${shown.length} de ${records.length} códigos.` : records.length ? 'Ningún QR coincide con la búsqueda.' : 'Todavía no hay QR guardados.');
  }
  async function save() {
    if (busy) return;
    const user = auth.currentUser;
    if (!authorizedUi() || !user) return state('Inicia sesión como administrador para guardar.', true);
    const snapshot = bridge.snapshot();
    if (!snapshot) return state('Genera primero un QR que supere la comprobación de lectura.', true);
    let name, data;
    try { name = currentName(); data = recordData(snapshot, name, user, editing); }
    catch (error) { return state(error.message, true); }
    if (editing && snapshot.url !== editing.url && !confirm(
      'La URL cambió. Se guardará un QR nuevo para este registro. Los QR ya impresos seguirán apuntando al destino anterior. ¿Continuar?')) return;
    busy = true; syncSave(); state('Guardando…');
    try {
      if (editing) await collection.doc(editing.id).update(data);
      else await collection.add(createdData(data, user));
      editing = null; syncSave();
      state('QR guardado correctamente. Las impresiones anteriores conservan su propio destino.');
    } catch (error) {
      state(error.code === 'permission-denied'
        ? 'Firestore rechazó el guardado: aún falta publicar la regla de staticMarketingQrs.'
        : 'No se pudo guardar el QR. Comprueba la conexión y vuelve a intentarlo.', true);
    } finally { busy = false; syncSave(); }
  }
  async function load(record) {
    if (!validRecord(record)) { listState('El registro tiene una URL inválida y no se puede abrir ni descargar.', true); return false; }
    switchTab('create');
    const ok = await bridge.loadSaved(record);
    if (!ok) { state('El diseño guardado no pudo regenerarse o superar la lectura. Ajusta la configuración.', true); return false; }
    syncSave(); return true;
  }
  async function handleAction(button) {
    const record = records.find(row => row.id === button.dataset.qrId);
    if (!record || !authorizedUi()) return;
    const type = button.dataset.qrAction;
    if (['open', 'png', 'svg'].includes(type)) { editing = null; syncSave(); }
    if (type === 'open') {
      if (!validRecord(record)) return listState('Este QR tiene una URL inválida.', true);
      window.open(record.url, '_blank', 'noopener,noreferrer');
      await load(record);
    } else if (type === 'edit') {
      editing = record;
      if (await load(record)) state('Editando QR guardado. Cambiar la URL no modifica ejemplares ya impresos.');
      else editing = null;
      syncSave();
    } else if (type === 'png' || type === 'svg') {
      if (await load(record)) await bridge.download(type);
    } else if (type === 'duplicate') {
      if (!validRecord(record)) return listState('No se puede duplicar un QR con URL inválida.', true);
      if (busy) return;
      busy = true; syncSave(); listState('Duplicando…');
      try {
        await collection.add(createdData(recordData({url:record.url,destinationType:record.destinationType,
          placeId:record.placeId,config:record.config},`${record.name} (copia)`.slice(0,80),auth.currentUser),auth.currentUser));
        listState('QR duplicado con ID nuevo.');
      } catch (error) { listState(error.code === 'permission-denied' ? 'Falta publicar la regla de staticMarketingQrs.' : 'No se pudo duplicar el QR.', true); }
      finally { busy = false; syncSave(); }
    } else if (type === 'delete' && confirm(`¿Eliminar “${record.name}”? Los QR ya impresos seguirán funcionando porque contienen la URL estática.`)) {
      if (busy) return;
      busy = true; syncSave(); listState('Eliminando…');
      try { await collection.doc(record.id).delete(); listState('Registro eliminado.'); if (editing?.id === record.id) { editing=null;syncSave(); } }
      catch (error) { listState(error.code === 'permission-denied' ? 'Falta publicar la regla de staticMarketingQrs.' : 'No se pudo eliminar el QR.', true); }
      finally { busy = false; syncSave(); }
    }
  }
  $('staticQrCreateTab').addEventListener('click', () => switchTab('create'));
  $('staticQrNew').addEventListener('click', () => {
    editing = null;
    $('staticQrName').value = '';
    $('staticQrDestination').value = 'home';
    $('staticQrLogo').checked = false;
    $('staticQrLevel').value = 'M';
    $('staticQrDestination').dispatchEvent(new Event('change', { bubbles: true }));
    state('Nuevo QR: escribe un nombre y guarda cuando la vista previa esté lista.');
    syncSave();
  });
  $('staticQrSavedTab').addEventListener('click', () => switchTab('saved'));
  $('staticQrSearch').addEventListener('input', renderList);
  $('staticQrFilter').addEventListener('change', renderList);
  $('staticQrSavedList').addEventListener('click', event => {
    const button = event.target.closest('button[data-qr-action]');
    if (button) handleAction(button).catch(() => listState('No se pudo completar la acción.', true));
  });
  $('staticQrSave').addEventListener('click', save);
  $('staticQrName').addEventListener('input', syncSave);
  new MutationObserver(syncSave).observe($('staticQrPreviewUrl'), { childList: true, characterData: true, subtree: true });
  new MutationObserver(syncSave).observe(adminView, { attributes: true, attributeFilter: ['class'] });
  auth.onAuthStateChanged(user => {
    if (!user) {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      records = []; editing = null; renderList();
      state('Inicia sesión como administrador para guardar.');
    }
    syncSave();
  });
  syncSave();
})();
