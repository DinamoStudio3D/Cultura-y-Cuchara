/* Presentation for the existing program/passport forms. Does not write to Firebase. */
(function(){
 'use strict';
 const get=id=>document.getElementById(id),line=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 function loyalty(){
  const host=get('existingRewardSummary');if(!host)return;
  const place=get('programPlace'),selected=place.selectedOptions[0],target=get('programTarget').value,daily=get('programDaily').value,title=get('programReward').value.trim(),validity=get('programValidity').value,stock=get('programStock').value;
  host.replaceChildren(line('small','RESUMEN DE ESTA TARJETA'),line('h3',place.value?selected.textContent:'Selecciona una parada'),line('h4',title||'Escribe el beneficio que recibirá el cliente'),line('p',target+' sellos para obtenerlo · máximo '+daily+' al día'),line('p',get('programDescription').value.trim()||'Describe qué incluye el beneficio y las condiciones para canjearlo.'),line('p',validity+' días para canjear desde que se obtiene · '+(stock===''?'premios sin límite de cantidad':stock+' premios en total')),line('small',get('programActive').checked?'Tarjeta habilitada al guardar':'Tarjeta pausada al guardar'));
 }
 function passports(){
  const host=get('existingPassportSummary');if(!host)return;host.replaceChildren();
  for(const suffix of ['Tourist','Local']){
   const title=get('passport'+suffix+'Title'),merchant=get('passport'+suffix+'Merchant'),panel=line('article',''),enabled=get('passportCampaignActive').checked&&get('passport'+suffix+'Active').checked;
   panel.append(line('small',suffix==='Tourist'?'PASAPORTE TURISTA · 1 HOSPEDAJE + 5 PARADAS GASTRONÓMICAS':'PASAPORTE LOJANO · 6 PARADAS GASTRONÓMICAS'),line('h4',title.value.trim()||'Premio sin definir'),line('p',get('passport'+suffix+'Description').value.trim()||'Añade el beneficio y las instrucciones para recibirlo.'),line('p','Entrega: '+(merchant?.value?merchant.selectedOptions[0].textContent:'Selecciona el negocio de entrega')),line('small',enabled?'Premio habilitado al guardar':'Premio desactivado al guardar'));host.append(panel);
  }
 }
 get('programForm')?.addEventListener('input',loyalty);get('programForm')?.addEventListener('change',loyalty);get('passportForm')?.addEventListener('input',passports);get('passportForm')?.addEventListener('change',passports);
 document.querySelectorAll('[data-existing-mode]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-existing-mode]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));document.querySelectorAll('[data-existing-reward]').forEach(panel=>panel.hidden=panel.dataset.existingReward!==button.dataset.existingMode);}));
 window.refreshExistingRewardSummary=()=>{loyalty();passports();};window.refreshExistingRewardSummary();
})();
