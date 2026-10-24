/* Reusable V2 screens. Mount explicitly with an isolated Firebase app and client. */
(function(root){
 'use strict';
 const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
 const date=value=>{const at=Number(value?.toMillis?.()??value);return Number.isFinite(at)?new Intl.DateTimeFormat('es-EC',{dateStyle:'medium',timeZone:'America/Guayaquil'}).format(new Date(at)):'Sin fecha disponible';};
 function screen(host,app,client,title){
  if(!app?.options?.projectId||app.options.projectId==='cultura-y-cuchara'||client.projectId!==app.options.projectId)throw Error('Selecciona la cuenta y el servicio del mismo entorno aislado.');
  host.classList.add('reward-editor','reward-portal');
  const heading=node('h3',title),notice=node('p','Versión en preparación. Los sellos y premios del sistema vigente se mantienen separados.','reward-notice'),status=node('p'),content=node('div');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');host.replaceChildren(heading,notice,status,content);
  let generation=0,busy=false,disposed=false;
  function reset(){generation++;busy=false;content.replaceChildren();status.textContent=app.auth().currentUser?'':'Inicia sesión para continuar.';}
  async function run(action){if(busy||disposed)return;const uid=app.auth().currentUser?.uid;if(!uid){reset();return;}const current=++generation;busy=true;host.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);status.textContent='Cargando…';try{await action({call:(operation,input)=>client.call(operation,input),valid:()=>!disposed&&generation===current&&app.auth().currentUser?.uid===uid});}catch(error){if(current===generation)status.textContent=error.message||'No se pudo completar. Consulta el estado antes de repetir.';}finally{if(current===generation){busy=false;host.querySelectorAll('button,input,select').forEach(el=>el.disabled=el.dataset.unavailable==='true');}}}
  let unsubscribe=()=>{};
  return{content,status,run,reset,listen(fn){unsubscribe=app.auth().onAuthStateChanged(user=>{reset();if(user)fn();});},dispose(){disposed=true;reset();unsubscribe();host.replaceChildren();}};
 }
 function customer(host,{app,client}){
  const view=screen(host,app,client,'Mis tarjetas y premios');
  function render(data,catalog){
   const cards=node('div',undefined,'reward-grid'),claims=node('section');
   for(const card of data.cards||[]){
    const panel=node('section',undefined,'reward-portal-card'),p=card.policy,progress=card.progress;
    panel.append(node('p',card.kind==='passport'?(card.mode==='tourist'?'PASAPORTE TURISTA':'PASAPORTE LOJANO'):(card.cardType==='seasonal'?'TARJETA DE TEMPORADA':'TARJETA HABITUAL'),'reward-eyebrow'),node('h4',p.title||card.placeId));
    panel.append(node('p',card.kind==='passport'?`${progress.count} de ${progress.total} paradas diferentes`:`${progress.count} de ${progress.target} sellos · ${progress.cycles} premios alcanzados`));
    if(card.kind==='loyalty'&&card.available){const generate=node('button','Obtener código para sellar'),codePanel=node('div');generate.type='button';generate.onclick=()=>view.run(async task=>{const result=await task.call('customer/visit-code',{enrollmentId:card.id});if(!task.valid())return;codePanel.replaceChildren(node('p',result.code,'reward-claim-code'),node('p','Muéstralo al encargado de esta parada. El código dura diez minutos.'));view.status.textContent='Código de visita preparado. Actualiza tus tarjetas después de que el encargado confirme.';});panel.append(generate,codePanel);}
    if(p.endAt)panel.append(node('p','Fin de la tarjeta: '+date(Date.parse(p.endAt))));
    if(!card.available)panel.append(node('p','Esta tarjeta ya no admite nuevas solicitudes. Tus premios obtenidos aparecen abajo.','reward-notice'));
    const rewards=card.kind==='passport'?(p[card.mode]?.rewards||[]):[p.reward];
    const alreadyChosen=card.kind==='passport'&&(data.claims||[]).some(claim=>claim.enrollmentId===card.id);
    const earned=card.kind==='passport'?progress.complete&&!alreadyChosen:progress.cycles>Number(card.claimedCycles||0);
    for(const reward of rewards.filter(r=>r?.active)){
     const detail=node('div');detail.append(node('h4',reward.title),node('p',reward.description||''));
     const button=node('button',card.kind==='passport'?(alreadyChosen?'Premio ya elegido':'Elegir este premio'):'Obtener premio');button.type='button';button.disabled=!card.available||!earned;
     // Preserve business eligibility when the shared request lock is released.
     button.dataset.unavailable=String(button.disabled);
     button.onclick=()=>view.run(async task=>{await task.call('customer/claim',{enrollmentId:card.id,rewardId:reward.id,expectedCycle:card.kind==='loyalty'?Number(card.claimedCycles||0)+1:0});const updated=await task.call('customer/wallet',{});if(!task.valid())return;render(updated,catalog);view.status.textContent='Premio solicitado. Presenta su código en el negocio indicado.';});
     detail.append(button);panel.append(detail);
    }
    cards.append(panel);
   }
   if(!cards.childNodes.length)cards.append(node('p','Todavía no tienes tarjetas en este entorno.'));
   claims.append(node('h4','Premios obtenidos'));if(data.cleanup?.needsReview)claims.append(node('p','Algunos premios vencidos necesitan revisión del negocio.','reward-notice'));
   for(const claim of data.claims||[]){const panel=node('article',undefined,'reward-portal-card');panel.append(node('h4',claim.rewardSnapshot?.title||'Premio'),node('p',claim.rewardSnapshot?.description||''),node('p','Entrega: '+claim.placeId));const expired=Number(claim.expiresAt)<=Number(data.serverNow);panel.append(node('p',claim.status==='delivered'?'Entregado':claim.status==='cancelled'?'Cancelado tras revisión':claim.status==='needs-review'?'Necesita revisión por un sello anulado':claim.status!=='pending'?'No disponible':expired?'Plazo vencido':'Disponible para presentar en el negocio'));if(claim.status==='pending'&&!expired){panel.append(node('p',claim.claimCode,'reward-claim-code'),node('p','Presenta este código al encargado. No lo publiques.'));}panel.append(node('p','Válido hasta: '+date(claim.expiresAt)));claims.append(panel);}
   if(!(data.claims||[]).length)claims.append(node('p','Aún no tienes premios obtenidos.'));
   const reload=node('button','Actualizar mis tarjetas');reload.type='button';reload.onclick=load;
   const enrollment=node('form'),label=node('label'),select=node('select'),join=node('button','Abrir tarjeta o pasaporte');
   label.append(node('span','Elige una tarjeta o recorrido'),select);
   for(const [index,item] of (catalog?.programs||[]).entries()){const option=node('option',item.title);option.value=String(index);select.append(option);}
   join.type='submit';enrollment.append(label,join);
   enrollment.onsubmit=event=>{event.preventDefault();const item=catalog?.programs?.[Number(select.value)];if(!item)return;view.run(async task=>{await task.call('customer/enroll',{kind:item.kind,placeId:item.placeId,mode:item.mode});const updated=await task.call('customer/wallet',{});if(!task.valid())return;render(updated,catalog);view.status.textContent='Tarjeta disponible. El progreso anterior se conserva.';});};
   view.content.replaceChildren(reload,...((catalog?.programs||[]).length?[enrollment]:[]),cards,claims);
  }
  function load(){return view.run(async task=>{const [data,catalog]=await Promise.all([task.call('customer/wallet',{}),task.call('customer/catalog',{})]);if(!task.valid())return;render(data,catalog);view.status.textContent='Tarjetas actualizadas.';});}
  view.listen(load);return{reload:load,dispose:view.dispose};
 }
 function merchant(host,{app,client}){
  const view=screen(host,app,client,'Verificar y entregar un premio');
  function render(){
   let selected=null;const form=node('form'),label=node('label'),input=node('input'),lookup=node('button','Consultar premio'),result=node('section');input.type='text';input.autocomplete='off';input.maxLength=21;input.pattern='[Vv][Ll]-[A-Fa-f0-9]{18}';input.required=true;label.append(node('span','Código del visitante'),input);lookup.type='submit';form.append(label,lookup);input.oninput=()=>{selected=null;result.replaceChildren();};
   form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;selected=null;result.replaceChildren();view.run(async task=>{const claim=await task.call('merchant/lookup-claim',{claimCode:input.value});if(claim.status==='pending'&&claim.expired){const expiry=await task.call('merchant/expire-claim',{claimId:claim.id});claim.status=expiry.status;}if(!task.valid())return;selected=claim;result.append(node('h4',claim.reward.title),node('p',claim.reward.description||''),node('p','Entrega: '+claim.placeId),node('p','Válido hasta: '+date(claim.expiresAt)));if(claim.status!=='pending'||claim.expired){result.append(node('p',claim.status==='delivered'?'Este premio ya fue entregado.':'Este premio no está disponible para entregar.','reward-notice'));view.status.textContent='Consulta completada.';return;}const confirm=node('input');confirm.type='checkbox';const presence=node('label');presence.append(confirm,node('span','El visitante está presente y recibirá el beneficio indicado.'));const deliver=node('button','Confirmar entrega');deliver.type='button';deliver.onclick=()=>{if(!confirm.checked){view.status.textContent='Confirma la presencia del visitante antes de entregar.';return;}const captured=selected;if(!captured)return;view.run(async delivery=>{const response=await delivery.call('merchant/deliver',{claimId:captured.id});if(!delivery.valid())return;selected=null;result.replaceChildren(node('h4',response.alreadyDelivered?'Este premio ya fue entregado.':'Entrega registrada'),node('p',captured.reward.title));view.status.textContent='El premio quedó marcado como entregado.';});};result.append(presence,deliver);view.status.textContent='Comprueba el beneficio antes de entregarlo.';});};
   const reversal=node('div');
   const stampForm=node('form'),stampTitle=node('h4','Confirmar una visita'),stampLabel=node('label'),stampCode=node('input'),amountLabel=node('label'),amount=node('input'),presenceLabel=node('label'),presence=node('input'),submit=node('button','Confirmar visita y sello');stampCode.type='text';stampCode.pattern='[A-Fa-f0-9]{12}';stampCode.maxLength=12;stampCode.required=true;stampCode.autocomplete='off';amount.type='number';amount.min='0';amount.max='100000';amount.step='0.01';amount.required=true;presence.type='checkbox';presence.required=true;stampLabel.append(node('span','Código de visita de 12 caracteres'),stampCode);amountLabel.append(node('span','Consumo registrado ($)'),amount);presenceLabel.append(presence,node('span','El visitante está presente y cumple las condiciones de la tarjeta.'));submit.type='submit';stampForm.append(stampTitle,stampLabel,amountLabel,presenceLabel,submit);stampForm.onsubmit=event=>{event.preventDefault();if(!stampForm.reportValidity())return;view.run(async task=>{const response=await task.call('merchant/confirm-visit',{code:stampCode.value,purchaseAmount:Number(amount.value)});if(!task.valid())return;stampForm.reset();const label=node('label'),reason=node('input'),undo=node('button','Anular esta visita');reason.type='text';reason.maxLength=300;label.append(node('span','Motivo de anulación (si hubo un error)'),reason);undo.type='button';undo.onclick=()=>{if(reason.value.trim().length<5){view.status.textContent='Escribe el motivo de anulación (mínimo 5 caracteres).';return;}view.run(async action=>{const result=await action.call('merchant/reverse-visit',{requestId:response.requestId,reason:reason.value});if(!action.valid())return;reversal.replaceChildren(node('p','Visita y sello anulados.'));view.status.textContent=result.affectedRewards?'Los premios afectados quedaron bloqueados para revisión.':'La anulación quedó registrada.';});};reversal.replaceChildren(node('p','Si fue un error, el mismo encargado puede anular la última visita durante quince minutos.'),label,undo);view.status.textContent=response.alreadyConfirmed?'Esta visita ya estaba confirmada; no se añadió otro sello.':'Visita y sello registrados. El visitante ya puede actualizar su tarjeta.';});};
   view.content.replaceChildren(stampForm,reversal,node('h4','Entregar un premio'),form,result);view.status.textContent='Confirma una visita o consulta el código de un premio.';
  }
  view.listen(render);return{dispose:view.dispose};
 }
 function review(host,{app,client}){
  const view=screen(host,app,client,'Premios que necesitan revisión');
  function render(data){
   const reload=node('button','Actualizar revisiones');reload.type='button';reload.onclick=load;view.content.replaceChildren(reload);
   if(!data.claims.length)view.content.append(node('p','No hay premios pendientes de revisión.'));
   if(data.claims.length>=data.limit)view.content.append(node('p','Se muestran los primeros '+data.limit+' casos. Resuelve estos y actualiza para ver los siguientes.','reward-notice'));
   for(const claim of data.claims){
    const panel=node('section',undefined,'reward-portal-card'),reasonLabel=node('label'),reason=node('textarea'),confirmLabel=node('label'),confirm=node('input');
    reason.maxLength=300;reasonLabel.append(node('span','Motivo de la resolución'),reason);confirm.type='checkbox';confirmLabel.append(confirm,node('span','Si cancelo, el premio se cerrará y su cupo se devolverá; no se creará otro premio automáticamente.'));
    panel.append(node('h4',claim.title),node('p','Parada de entrega: '+claim.placeId),node('p','Cuenta: '+claim.userId),node('p','Válido hasta: '+date(claim.expiresAt)),node('p','Bloqueado porque se anuló un sello que sostenía este premio.'),reasonLabel,confirmLabel);
    for(const [decision,title]of [['restore','Recuperar si vuelve a cumplir la meta'],['cancel','Cancelar premio y devolver cupo']]){
     const button=node('button',title);button.type='button';button.onclick=()=>{
      if(reason.value.trim().length<5){view.status.textContent='Escribe el motivo de la resolución (mínimo 5 caracteres).';return;}
      if(decision==='cancel'&&!confirm.checked){view.status.textContent='Confirma el efecto de cancelar antes de continuar.';return;}
      view.run(async task=>{await task.call('admin/resolve-review',{claimId:claim.id,decision,reason:reason.value,expectedReviewVisitId:claim.reviewVisitId});const updated=await task.call('admin/review-queue',{});if(!task.valid())return;render(updated);view.status.textContent=decision==='restore'?'Premio recuperado con su código y plazo originales.':'Premio cancelado y cupo devuelto.';});
     };panel.append(button);
    }
    view.content.append(panel);
   }
  }
  function load(){return view.run(async task=>{const data=await task.call('admin/review-queue',{});if(!task.valid())return;render(data);view.status.textContent='Revisiones actualizadas.';});}
  view.listen(load);return{reload:load,dispose:view.dispose};
 }
 function publication(host,{app,client}){
  const view=screen(host,app,client,'Publicar configuración de beneficios');
  function load(){return view.run(async task=>{const data=await task.call('admin/load',{});if(!task.valid())return;const draft=data.draft,summary=node('section'),reload=node('button','Recargar configuración');reload.type='button';reload.onclick=load;summary.append(reload);if(!draft){summary.append(node('p','Guarda primero un borrador desde el editor.'));view.content.replaceChildren(summary);view.status.textContent='No hay un borrador para publicar.';return;}const config=draft.configuration;summary.append(node('h4','Configuración pendiente'),node('p',Object.keys(config.programs||{}).length+' paradas configuradas'),node('p','Campaña: '+(config.passport?.title||'Sin nombre')),node('p','Los sellos y beneficios de las tarjetas ya abiertas conservan sus condiciones.'));const checkbox=node('input');checkbox.type='checkbox';const label=node('label');label.append(checkbox,node('span','He revisado las metas, los premios y los encargados de entrega.'));const button=node('button','Publicar esta versión');button.type='button';button.onclick=()=>{if(!checkbox.checked){view.status.textContent='Revisa la configuración y marca la confirmación antes de publicar.';return;}view.run(async publish=>{const result=await publish.call('admin/publish',{expectedDraftRevision:draft.revision,expectedPublishedRevision:data.published?.revision||''});if(!publish.valid())return;summary.replaceChildren(node('h4','Configuración publicada'),node('p','Versión: '+result.revision),reload);view.status.textContent='La versión está disponible en este entorno de pruebas.';});};summary.append(label,button);view.content.replaceChildren(summary);view.status.textContent='Revisa la configuración antes de publicar.';});}
  view.listen(load);return{reload:load,dispose:view.dispose};
 }
 root.VisitaLojaRewardProgramsPortal=Object.freeze({customer,merchant,publication,review});
})(typeof window==='object'?window:globalThis);
