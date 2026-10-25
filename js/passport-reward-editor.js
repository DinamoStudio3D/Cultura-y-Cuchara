/* Additional choices use the existing passport campaign and redemption records. */
(function(){
 'use strict';
 const state={Tourist:[],Local:[]},esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const form=document.getElementById('passportForm');if(!form)return;
 function collect(suffix){return Array.from(document.querySelectorAll('[data-passport-choice="'+suffix+'"]')).map(row=>({id:row.dataset.choiceId,active:row.querySelector('[data-field="active"]').checked,...Object.fromEntries(['title','description','merchantUid'].map(key=>[key,row.querySelector('[data-field="'+key+'"]').value.trim()]))}));}
 function render(suffix){
  const host=document.getElementById('passportChoices'+suffix);if(!host)return;
  host.innerHTML=state[suffix].map(item=>'<article class="existing-choice-card" data-passport-choice="'+suffix+'" data-choice-id="'+esc(item.id)+'"><div class="existing-choice-heading"><label><input type="checkbox" data-field="active" '+(item.active!==false?'checked':'')+'> Ofrecer esta opción</label><button type="button" data-remove="'+esc(item.id)+'" aria-label="Quitar esta opción">Quitar</button></div><label>Nombre del beneficio<input class="field" data-field="title" maxlength="100" value="'+esc(item.title)+'"></label><label>Condiciones e instrucciones<textarea class="field" data-field="description" maxlength="400">'+esc(item.description)+'</textarea></label><label>Negocio que entrega<select class="field" data-field="merchantUid"><option value="">Seleccionar negocio</option>'+adminMissionMerchants.filter(m=>m.active!==false||m.id===item.merchantUid).map(m=>'<option value="'+esc(m.id)+'" '+(m.id===item.merchantUid?'selected':'')+'>'+esc(m.businessName||m.email||m.id)+(m.active===false?' (inactivo)':'')+'</option>').join('')+'</select></label></article>').join('');
 }
 for(const suffix of ['Tourist','Local']){
  const host=document.createElement('section');host.className='existing-choice-editor';host.innerHTML='<h4>Más recompensas para elegir</h4><p>El premio principal también será una opción. Cada persona elige uno y genera un único código para esta modalidad y campaña.</p><div id="passportChoices'+suffix+'"></div><button type="button" data-add="'+suffix+'">Añadir alternativa</button>';
  document.querySelector('[data-existing-reward="'+suffix+'"]').append(host);
 }
 form.addEventListener('click',event=>{
  const add=event.target.closest('[data-add]'),remove=event.target.closest('[data-remove]');if(!add&&!remove)return;
  const suffix=add?.dataset.add||remove.closest('[data-passport-choice]').dataset.passportChoice;state[suffix]=collect(suffix);
  if(add){if(state[suffix].length>=9){alert('Puedes configurar hasta diez opciones contando el premio principal.');return;}state[suffix].push({id:'reward-'+crypto.randomUUID(),active:true,title:'',description:'',merchantUid:''});}
  else state[suffix]=state[suffix].filter(item=>item.id!==remove.dataset.remove);
  render(suffix);
 });
 window.VisitaLojaPassportRewardEditor={
  load(config){for(const [suffix,key]of [['Tourist','tourist'],['Local','local']]){state[suffix]=Object.entries(config[key]?.choices||{}).filter(([id])=>id!=='primary').map(([id,item])=>({...item,id}));render(suffix);}},
  refresh(){for(const suffix of ['Tourist','Local']){state[suffix]=collect(suffix);render(suffix);}},
  read(suffix,primary){const items=collect(suffix);if(!items.length)return null;const choices={primary:{active:primary.active,title:primary.title,description:primary.description,merchantUid:primary.merchantUid}};for(const item of items){if(item.active&&(!item.title||!adminMissionMerchants.some(m=>m.id===item.merchantUid&&m.active!==false)))throw Error('Cada alternativa activa necesita nombre y un negocio de entrega disponible.');choices[item.id]={active:item.active,title:item.title,description:item.description,merchantUid:item.merchantUid};}return choices;}
 };
})();
