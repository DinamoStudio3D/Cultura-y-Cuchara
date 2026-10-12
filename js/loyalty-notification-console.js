/* Service actions are explicit. No startup consultation, publication or delivery. */
(function () {
  'use strict';
  const host = document.getElementById('loyaltyNotificationConsole'); if (!host) return;
  const customer = host.dataset.role === 'customer', admin = host.dataset.role === 'admin';
  const el = id => document.getElementById(id), user = () => typeof auth !== 'undefined' ? auth.currentUser : null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let uid = '', selected = '', generation = 0, loaded = null, busy = false, prepared = null, review = null;
  const passes = new Map();
  host.innerHTML = `<div class="loyalty-studio-heading"><span>AVISOS INTERNOS · PREPARACIÓN</span><h2>${customer?'Avisos de tus negocios favoritos':'Control de avisos por negocio'}</h2><p>${customer?'Consulta tus avisos y márcalos como leídos. El servicio todavía está pendiente de activación.':'Guarda una promoción en el servicio, revisa su publicación y entrega avisos por lotes. La activación sigue pendiente de validación en Firebase aislado.'}</p></div>
  ${customer?'':`<label class="notification-field">Negocio<select id="noticePlace"><option value="">Selecciona una parada</option></select></label>`}
  <div class="loyalty-studio-actions"><button id="noticeLoad" type="button">${customer?'Consultar mis avisos':'Consultar servicio'}</button></div><p id="noticeStatus" role="status"></p>
  ${admin?`<form id="noticeConfig" class="promotion-form"><h3 class="font-black">Permisos administrativos</h3><label class="notification-check"><input id="noticeEnabled" type="checkbox"> Permitir avisos de esta parada</label><label class="notification-check"><input id="noticeOwner" type="checkbox"> Autorizar al propietario a publicar y entregar avisos</label><div class="loyalty-studio-window"><label>Máximo de avisos por día<input id="noticeDaily" type="number" min="1" max="500" value="100" required></label><label>Tamaño de lote<input id="noticeBatch" type="number" min="1" max="50" value="25" required></label></div><p class="promotion-note">Solo avisos internos para seguidores con consentimiento. No activa push ni programa envíos.</p><button id="noticeSave" type="submit" disabled>Guardar controles en el servicio</button></form>`:''}
  ${customer?'':`<section id="noticeReview" class="promotion-draft notification-review" hidden><small id="noticeReviewMode"></small><h3 id="noticeReviewTitle"></h3><p id="noticeReviewMessage"></p><p id="noticeReviewConditions"></p><p id="noticeReviewDates"></p><p class="promotion-note">Público: seguidores activos de esta parada que aceptaron promociones. Publicar no entrega avisos. La entrega se inicia por separado, un lote por clic. Sin push.</p><div class="loyalty-studio-actions"><button id="noticeSaveDraft" type="button" disabled>Guardar borrador en el servicio</button><button id="noticeConfirmPublish" type="button" disabled>Confirmar publicación, sin enviar avisos</button><button id="noticeCloseReview" type="button">Cerrar revisión</button></div></section>`}
  <div id="noticeList" class="promotion-library"></div>`;
  const say = message => el('noticeStatus').textContent = message;
  const canWrite = () => !!loaded && loaded.runtime?.enabled === true;
  const canPublish = () => canWrite() && loaded.program?.enabled === true && loaded.runtime?.placePublished !== false && (admin || loaded.program?.ownerCanPublish === true);
  const canDeliver = () => canPublish() && loaded.runtime?.followersEnabled !== false;
  function reset() {
    generation++; loaded = null; prepared = null; review = null; busy = false; passes.clear();
    el('noticeLoad').disabled = false; el('noticeList').replaceChildren(); say('');
    if (!customer) { el('noticeReview').hidden = true; el('noticeSaveDraft').disabled = true; el('noticeConfirmPublish').disabled = true; }
    if (admin) { el('noticeEnabled').checked = false; el('noticeOwner').checked = false; el('noticeDaily').value = '100'; el('noticeBatch').value = '25'; el('noticeSave').disabled = true; }
  }
  function refresh() {
    const current = user()?.uid || '', items = typeof places !== 'undefined' && current ? places : [];
    const previous = customer ? '' : el('noticePlace').value;
    if (!customer) {
      el('noticePlace').innerHTML = '<option value="">Selecciona una parada</option>' + items.map(place => `<option value="${esc(place.id)}">${esc(place.title || place.id)}</option>`).join('');
      if (current === uid && items.some(place => place.id === previous)) el('noticePlace').value = previous;
    }
    const next = customer ? '' : el('noticePlace').value;
    if (current !== uid || next !== selected) reset(); uid = current; selected = next;
  }
  function dateValue(value) {
    const number = typeof value === 'number' ? value : value?.toMillis?.() ?? (value?.seconds ?? value?._seconds) * 1000;
    if (typeof value === 'string') return Date.parse(value + ':00-05:00');
    return number;
  }
  function stamp(value) { const number = dateValue(value); return Number.isFinite(number) ? new Date(number).toLocaleString('es-EC',{timeZone:'America/Guayaquil'}) : 'Sin fecha'; }
  function reviewPanel() {
    if (customer) return;
    const value = review || prepared;
    el('noticeReview').hidden = !value;
    if (!value) return;
    el('noticeReviewMode').textContent = (review ? 'REVISIÓN ANTES DE PUBLICAR' : 'BORRADOR LOCAL PARA GUARDAR EN EL SERVICIO') + ' · ' + (places.find(place=>place.id===selected)?.title||selected);
    el('noticeReviewTitle').textContent = value.title;
    el('noticeReviewMessage').textContent = value.message;
    el('noticeReviewConditions').textContent = 'Condiciones: ' + (value.conditions || 'Sin condiciones adicionales.');
    el('noticeReviewDates').textContent = 'Inicio: ' + stamp(value.startsAt) + ' · Fin: ' + stamp(value.endsAt) + ' (Ecuador)';
    el('noticeSaveDraft').hidden = !!review;
    el('noticeConfirmPublish').hidden = !review;
    el('noticeSaveDraft').disabled = busy || !canWrite() || !prepared;
    el('noticeConfirmPublish').disabled = busy || !canPublish() || !review;
  }
  function render() {
    const list = el('noticeList'); list.replaceChildren(); reviewPanel(); if (!loaded) return;
    if (admin) {
      const program = loaded.program || {};
      el('noticeEnabled').checked = program.enabled === true; el('noticeOwner').checked = program.ownerCanPublish === true;
      el('noticeDaily').value = program.maxDailyDeliveries ?? 100; el('noticeBatch').value = program.batchSize ?? 25;
      el('noticeSave').disabled = busy || !canWrite();
    }
    if (customer) {
      const items = loaded.notifications || [];
      list.innerHTML = '<p class="promotion-note">' + items.filter(item=>item.readAt==null).length + ' sin leer entre los últimos ' + items.length + ' avisos consultados (máximo 50).</p>' + items.map(item => `<article class="promotion-draft"><small>${esc(item.placeName||item.placeId)} · ${item.readAt==null?'SIN LEER':'LEÍDO'}</small><h3>${esc(item.title)}</h3><p>${esc(item.message)}</p><p>${esc(item.conditions)}</p><p>${esc(stamp(item.createdAt))}</p><a class="notification-link" href="fidelidad.html?place=${encodeURIComponent(item.placeId||'')}">Ver tarjeta del negocio</a>${item.readAt==null?`<button type="button" class="notification-link" data-notice-read="${esc(item.notificationId)}">Marcar como leído</button>`:''}</article>`).join('');
      if (!items.length) list.innerHTML = '<p class="promotion-note">No tienes avisos internos disponibles. Seguir una parada no crea avisos automáticamente.</p>';
      return;
    }
    const campaigns = loaded.campaigns || [];
    list.innerHTML = '<p class="promotion-note">' + (loaded.runtime?.enabled?'Servicio habilitado':'Servicio pausado') + ' · ' + (loaded.program?.ownerCanPublish?'Propietario autorizado para publicar':'Publicación reservada al administrador') + '</p>' + campaigns.map(item => {
      const pass = passes.get(item.campaignId), inWindow = Date.now() >= item.startsAt && Date.now() < item.endsAt;
      return `<article class="promotion-draft"><small>${esc(({draft:'BORRADOR',published:'PUBLICADA',paused:'PAUSADA'})[item.status]||item.status)}</small><h4>${esc(item.title)}</h4><p>${esc(item.message)}</p><p>Condiciones: ${esc(item.conditions||'Sin condiciones adicionales.')}</p><p>${esc(stamp(item.startsAt))} — ${esc(stamp(item.endsAt))} (Ecuador)</p><p>${Number(item.deliveryCount||0)} avisos internos entregados.</p>
      ${item.status==='draft'?`<button type="button" class="notification-link" data-notice-publish="${esc(item.campaignId)}" ${!canPublish()||busy?'disabled':''}>Revisar y publicar</button>`:''}
      ${item.status==='published'?`<button type="button" class="notification-link" data-notice-dispatch="${esc(item.campaignId)}" ${!canDeliver()||!inWindow||busy?'disabled':''}>${pass?.complete?'Iniciar otra pasada':pass?.cursor?'Entregar siguiente lote':'Entregar primer lote'}</button><button type="button" class="notification-link" data-notice-pause="${esc(item.campaignId)}" ${busy?'disabled':''}>Pausar promoción</button><p class="promotion-note">${pass?.complete?'Recorrido actual completado. Una nueva pasada puede incluir nuevos seguidores.':pass?.cursor?'Quedan seguidores por recorrer. Continúa manualmente con el siguiente lote.':'Cada clic entrega como máximo '+Number(loaded.program?.batchSize||25)+' avisos. No hay entregas automáticas.'}</p>`:''}</article>`;
    }).join('');
    if (!campaigns.length) list.innerHTML += '<p class="promotion-note">No hay promociones guardadas en el servicio. Usa “Llevar al servicio” en un borrador local.</p>';
  }
  async function request(name,data,version) {
    const actor = user(); if (!actor) throw Error('Inicia sesión para continuar.');
    if (!customer && !selected) throw Error('Selecciona un negocio asignado.');
    const actorUid = actor.uid, placeId = selected;
    const response = await auth.app.functions('us-central1').httpsCallable(name)(data);
    if (version !== generation || user()?.uid !== actorUid || selected !== placeId) throw Error('La sesión o el negocio cambió.');
    return response.data;
  }
  async function run(operation,{read=false}={}) {
    if (busy) return; const version = generation; busy = true; el('noticeLoad').disabled = true;
    if (admin) el('noticeSave').disabled = true; reviewPanel();
    try { await operation(version); }
    catch (error) {
      if (version === generation) {
        say(window.VisitaLojaServiceErrors.message(error,{read,service:'avisos'}));
      }
    } finally { if (version === generation) { busy = false; el('noticeLoad').disabled = false; if (admin) el('noticeSave').disabled = !canWrite(); render(); } }
  }
  function upsert(campaign) { loaded.campaigns = [...(loaded.campaigns||[]).filter(value=>value.campaignId!==campaign.campaignId),campaign]; }
  el('noticeLoad').onclick = () => run(async version => {
    loaded = await request(customer?'getLoyaltyNotificationInbox':'getLoyaltyPromotionOverview',customer?{}:{placeId:selected},version);
    review = null; render(); say(customer?'Bandeja consultada.':'Servicio consultado. No se publicó ni se entregó ninguna promoción.');
  },{read:true});
  if (!customer) {
    el('noticePlace').onchange = () => { selected = el('noticePlace').value; reset(); };
    el('noticeCloseReview').onclick = () => { prepared = null; review = null; reviewPanel(); };
    window.prepareLoyaltyPromotionForService = ({actorUid,draft}) => {
      if (busy) throw Error('Espera a que termine la operación actual.');
      if (!user() || user().uid !== actorUid) throw Error('La cuenta cambió. Vuelve a seleccionar tu borrador.');
      const normalized = window.VisitaLojaLoyaltyPromotionPolicy.normalizeDraft(draft);
      if (!places.some(place=>place.id===normalized.placeId)) throw Error('Negocio no asignado.');
      if (!normalized.startsAt || !normalized.endsAt || dateValue(normalized.endsAt)-dateValue(normalized.startsAt)>30*86400000) throw Error('Para guardar en el servicio define inicio y fin con una duración máxima de 30 días.');
      if (selected !== normalized.placeId) { el('noticePlace').value = normalized.placeId; selected = normalized.placeId; reset(); }
      prepared = normalized; review = null; reviewPanel();
      say(canWrite()?'Revisa el borrador y guárdalo en el servicio. Todavía no está publicado.':'Borrador listo para revisión. Consulta el servicio para comprobar si permite guardarlo.');
      window.VisitaLojaAdminFidelityWorkspace?.select('notices',true);
      window.VisitaLojaMerchantWorkspace?.select('notices',true);
      host.scrollIntoView?.({behavior:'smooth',block:'start'}); return true;
    };
    el('noticeSaveDraft').onclick = () => {
      if (!prepared || !canWrite()) return;
      const local = prepared, existing = (loaded.campaigns||[]).find(campaign=>campaign.campaignId===local.promotionId);
      if (existing && existing.status !== 'draft') { say('Esta promoción ya fue publicada. Crea otro borrador local para cambiar su contenido.'); return; }
      return run(async version => {
        const saved = await request('saveLoyaltyPromotion',{...local,campaignId:local.promotionId,expectedVersion:existing?.version??0},version);
        upsert(saved); prepared = null; review = null;
        say('Borrador guardado en el servicio. Revisa su publicación cuando esté autorizado; no se entregaron avisos.');
      });
    };
    el('noticeConfirmPublish').onclick = () => {
      if (!review || !canPublish()) return;
      const campaign = review;
      return run(async version => {
        const result = await request('publishLoyaltyPromotion',{placeId:selected,campaignId:campaign.campaignId,expectedVersion:campaign.version},version);
        upsert({...campaign,status:result.status}); review = null;
        say('Promoción publicada. No se entregaron avisos; inicia el primer lote por separado.');
      });
    };
  }
  if (admin) el('noticeConfig').onsubmit = event => {
    event.preventDefault(); if (!canWrite()) return;
    return run(async version => {
      loaded.program = await request('configureLoyaltyNotifications',{placeId:selected,enabled:el('noticeEnabled').checked,ownerCanPublish:el('noticeOwner').checked,maxDailyDeliveries:Number(el('noticeDaily').value),batchSize:Number(el('noticeBatch').value)},version);
      say('Controles guardados. No se enviaron avisos.');
    });
  };
  el('noticeList').onclick = event => {
    const button = event.target.closest('[data-notice-read], [data-notice-pause], [data-notice-publish], [data-notice-dispatch]');
    if (!button || !loaded || busy) return;
    if (button.dataset.noticeRead && customer) return run(async version => {
      const notificationId = button.dataset.noticeRead;
      await request('markLoyaltyNotificationRead',{notificationId},version);
      loaded.notifications = loaded.notifications.map(item=>item.notificationId===notificationId?{...item,readAt:Date.now()}:item); say('Aviso marcado como leído.');
    });
    const campaignId = button.dataset.noticePause || button.dataset.noticePublish || button.dataset.noticeDispatch;
    const campaign = (loaded.campaigns||[]).find(item=>item.campaignId===campaignId); if (!campaign || customer) return;
    if (button.dataset.noticePublish) {
      if (!canPublish() || campaign.status !== 'draft') return;
      prepared = null; review = {...campaign}; reviewPanel(); el('noticeReview').scrollIntoView?.({behavior:'smooth',block:'start'}); return;
    }
    if (button.dataset.noticeDispatch) {
      if (!canDeliver() || campaign.status !== 'published' || Date.now()<campaign.startsAt || Date.now()>=campaign.endsAt) return;
      const pass = passes.get(campaignId), cursor = pass?.complete ? null : pass?.cursor??null;
      if (!window.confirm('Entregar un lote de avisos internos de “'+campaign.title+'” a seguidores de esta parada con consentimiento. Máximo '+Number(loaded.program?.batchSize||25)+' avisos. ¿Continuar?')) return;
      return run(async version => {
        const result = await request('dispatchLoyaltyPromotionBatch',{placeId:selected,campaignId,cursor},version);
        passes.set(campaignId,{cursor:result.nextCursor,complete:result.nextCursor===null});
        upsert({...campaign,deliveryCount:result.totalDelivered});
        say(result.created+' avisos nuevos · '+result.alreadyDelivered+' ya entregados. '+(result.nextCursor?'Quedan lotes; continúa manualmente.':'Recorrido actual completado.'));
      });
    }
    if (button.dataset.noticePause && campaign.status==='published' && window.confirm('¿Pausar esta promoción e impedir nuevos avisos?')) return run(async version => {
      await request('pauseLoyaltyPromotion',{placeId:selected,campaignId},version); upsert({...campaign,status:'paused'}); review = null; say('Promoción pausada.');
    });
  };
  window.refreshLoyaltyNotificationConsole = refresh;
  if (typeof auth !== 'undefined') auth.onAuthStateChanged(refresh); refresh();
})();
