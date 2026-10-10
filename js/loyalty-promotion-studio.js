/* Account/business scoped drafts only. No Firebase operations or notifications. */
(function () {
  'use strict';
  const host = document.getElementById('loyaltyPromotionStudio');
  const policy = window.VisitaLojaLoyaltyPromotionPolicy;
  if (!host || !policy) return;
  const role = host.dataset.role === 'admin' ? 'admin' : 'merchant';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const el = id => document.getElementById(id);
  const actor = () => typeof auth !== 'undefined' ? auth.currentUser : null;
  let session = '', selected = '', editingId = '';
  host.innerHTML = `<div class="loyalty-studio-heading"><span>PROMOCIONES · BORRADORES</span><h2>Una razón para volver a tu negocio</h2><p>Prepara ofertas para seguidores que aceptaron recibir promociones de esta parada. Los borradores se guardan en este dispositivo; todavía no se publican ni envían avisos.</p></div>
  <form id="loyaltyPromotionForm" class="promotion-form">
    <label>Negocio<select id="promoPlace" required><option value="">Selecciona una parada</option></select></label>
    <label>Título de la promoción<input id="promoTitle" maxlength="120" placeholder="Ej. Tu próxima tarde de café tiene un regalo" required></label>
    <label>Mensaje para tus seguidores<textarea id="promoMessage" maxlength="500" placeholder="Cuenta qué pueden disfrutar y cómo acceder al beneficio." required></textarea></label>
    <label>Condiciones<textarea id="promoConditions" maxlength="400" placeholder="Consumo mínimo, disponibilidad y restricciones."></textarea></label>
    <div class="loyalty-studio-window"><label>Inicio<input id="promoStart" type="datetime-local"></label><label>Fin<input id="promoEnd" type="datetime-local"></label></div>
    <p class="promotion-note">Fechas en hora de Ecuador. Definirlas no programa un envío. Público previsto: seguidores activos de este negocio que aceptaron promociones. Sin avisos push.</p>
    <div class="loyalty-studio-actions"><button type="submit" id="promoSave">Guardar borrador</button><button type="button" id="promoNew">Nueva promoción</button><button type="button" id="promoPreview">Ver aviso de ejemplo</button></div>
  </form><p id="promoStatus" role="status"></p><div id="promoNotification" aria-live="polite"></div>
  <div class="promotion-library"><h3>Promociones preparadas</h3><p class="promotion-note">Cada cuenta y negocio conserva su propia lista local. Editar o eliminar aquí modifica únicamente el borrador.</p><div id="promoList"></div></div>`;
  function key() {
    const uid = actor()?.uid, placeId = el('promoPlace').value;
    if (!uid || !placeId || !available().some(place => place.id === placeId)) throw Error('Inicia sesión y selecciona un negocio asignado.');
    return `visitaloja:loyalty-promotions:v1:${role}:${uid}:${placeId}`;
  }
  function available() { return typeof places !== 'undefined' && actor() ? places : []; }
  function readCatalog() {
    const raw = localStorage.getItem(key());
    if (!raw) return [];
    const values = JSON.parse(raw);
    if (!Array.isArray(values) || values.length > 50) throw Error('No se pudo leer la lista local de promociones.');
    const seen = new Set();
    return values.map(value => {
      const draft = policy.normalizeDraft(value);
      if (draft.placeId !== el('promoPlace').value || seen.has(draft.promotionId)) throw Error('La lista local contiene un borrador inválido.');
      seen.add(draft.promotionId); return draft;
    });
  }
  function say(message) { el('promoStatus').textContent = message; }
  function clearEditor() {
    editingId = '';
    for (const id of ['promoTitle','promoMessage','promoConditions','promoStart','promoEnd']) el(id).value = '';
    el('promoSave').textContent = 'Guardar borrador';
    el('promoNotification').replaceChildren();
    say('');
  }
  function readEditor(promotionId) {
    key();
    return policy.normalizeDraft({placeId:el('promoPlace').value, promotionId,
      title:el('promoTitle').value, message:el('promoMessage').value, conditions:el('promoConditions').value,
      startsAt:el('promoStart').value, endsAt:el('promoEnd').value});
  }
  function renderList() {
    const list = el('promoList'); list.replaceChildren();
    if (!actor() || !el('promoPlace').value) { list.textContent = 'Selecciona un negocio para ver sus borradores.'; return; }
    try {
      const drafts = readCatalog();
      list.innerHTML = drafts.length ? drafts.map(draft => `<article class="promotion-draft"><small>BORRADOR · ${esc(policy.scheduleLabel(draft))}</small><h4>${esc(draft.title)}</h4><p>${esc(draft.message)}</p><div class="loyalty-studio-actions"><button type="button" data-promo-edit="${esc(draft.promotionId)}">Editar</button><button type="button" data-promo-delete="${esc(draft.promotionId)}">Eliminar borrador</button></div></article>`).join('') : '<p class="promotion-note">Aún no hay promociones preparadas para este negocio.</p>';
    } catch (_) { say('No se pudo leer la lista local. No se sobrescribió ningún borrador.'); }
  }
  function refresh() {
    const uid = actor()?.uid || '', previous = el('promoPlace').value, items = available();
    el('promoPlace').innerHTML = '<option value="">Selecciona una parada</option>' + items.map(place => `<option value="${esc(place.id)}">${esc(place.title || place.id)}</option>`).join('');
    if (uid === session && items.some(place => place.id === previous)) el('promoPlace').value = previous;
    if (uid !== session || el('promoPlace').value !== selected) clearEditor();
    session = uid; selected = el('promoPlace').value;
    renderList();
  }
  el('promoPlace').onchange = () => { selected = el('promoPlace').value; clearEditor(); renderList(); };
  el('promoNew').onclick = clearEditor;
  el('loyaltyPromotionForm').onsubmit = event => {
    event.preventDefault();
    try {
      const storageKey = key(), drafts = readCatalog();
      const promotionId = editingId || crypto.randomUUID();
      const draft = readEditor(promotionId), index = drafts.findIndex(value => value.promotionId === promotionId);
      if (editingId && index < 0) throw Error('El borrador ya no existe. Crea una nueva promoción.');
      if (index < 0 && drafts.length >= 50) throw Error('Puedes guardar hasta 50 promociones por negocio.');
      if (index < 0) drafts.push(draft); else drafts[index] = draft;
      localStorage.setItem(storageKey,JSON.stringify(drafts));
      editingId = promotionId; el('promoSave').textContent = 'Guardar cambios del borrador'; renderList();
      say('Borrador guardado en este dispositivo. No se publicó ni se envió ninguna notificación.');
    } catch (error) { say(error.message || 'No se pudo guardar el borrador.'); }
  };
  el('promoPreview').onclick = () => {
    el('promoNotification').replaceChildren();
    try {
      const draft = readEditor(editingId || 'preview'), name = el('promoPlace').selectedOptions[0]?.textContent || '';
      const article = document.createElement('article'); article.className = 'loyalty-notification-example';
      for (const [tag,value] of [['small','EJEMPLO · '+name],['strong',draft.title],['p',draft.message],['p',draft.conditions]]) {
        const child = document.createElement(tag); child.textContent = value; article.append(child);
      }
      el('promoNotification').append(article); say('Aviso de ejemplo. No utiliza destinatarios reales ni envía mensajes.');
    } catch (error) { say(error.message); }
  };
  el('promoList').onclick = event => {
    const button = event.target.closest('[data-promo-edit], [data-promo-delete]'); if (!button) return;
    try {
      const storageKey = key(), drafts = readCatalog(), id = button.dataset.promoEdit || button.dataset.promoDelete;
      const draft = drafts.find(value => value.promotionId === id); if (!draft) return;
      if (button.dataset.promoDelete) {
        if (!window.confirm('¿Eliminar este borrador local?')) return;
        localStorage.setItem(storageKey, JSON.stringify(drafts.filter(value => value.promotionId !== id)));
        if (editingId === id) clearEditor(); renderList(); say('Borrador local eliminado.'); return;
      }
      clearEditor(); editingId = id;
      for (const [control,field] of [['promoTitle','title'],['promoMessage','message'],['promoConditions','conditions'],['promoStart','startsAt'],['promoEnd','endsAt']]) el(control).value = draft[field];
      el('promoSave').textContent = 'Guardar cambios del borrador'; say('Editando borrador local.');
    } catch (error) { say(error.message || 'No se pudo editar el borrador.'); }
  };
  window.refreshLoyaltyPromotionStudio = refresh;
  if (typeof auth !== 'undefined') auth.onAuthStateChanged(() => refresh());
  refresh();
})();
