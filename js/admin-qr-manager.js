/* Gestión de QR estáticos de difusión; separada de qrCodes y de los QR de visitas. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const bridge = window.visitaLojaStaticQr;
  if (!bridge || !$('staticQrSave')) return;
  const collection = db.collection('staticMarketingQrs');
  const timestamp = () => firebase.firestore.FieldValue.serverTimestamp();
  const types = { manual: 'URL personalizada', home: 'Inicio', place: 'Negocio o parada', routes: 'Rutas', passport: 'Pasaporte', agenda: 'Agenda', shop: 'Tienda', signup: 'Sumar negocio' };
  let records = [], unsubscribe = null, editing = null, busy = false, loading = false;
  function textNode(tag, className, value) { const node=document.createElement(tag); node.className=className; node.textContent=String(value??''); return node; }
  function state(value,error=false){const node=$('staticQrSaveState');node.textContent=value;node.className=`text-xs mt-2 ${error?'text-red-700':'text-gray-600'}`;}
  function listState(value,error=false){const node=$('staticQrListState');node.textContent=value;node.className=`text-sm mb-3 ${error?'text-red-300':'text-gray-400'}`;}
  function authorizedUi(){return Boolean(auth.currentUser&&!adminView.classList.contains('hidden'));}
  function syncSave(){ $('staticQrSave').disabled=busy||!authorizedUi()||!bridge.snapshot(); $('staticQrSave').lastChild.textContent=editing?'Guardar cambios':'Guardar QR'; }
  function currentName(){const name=$('staticQrName').value.trim();if(!name||name.length>80)throw new Error('Escribe un nombre de hasta 80 caracteres para guardar el QR.');return name;}
  function recordData(snapshot,name,user,original=null){const sameUrl=original&&snapshot.url===original.url;return{name,url:bridge.validateUrl(snapshot.url),destinationType:sameUrl&&snapshot.destinationType==='manual'?original.destinationType:snapshot.destinationType,placeId:sameUrl&&snapshot.destinationType==='manual'?original.placeId||'':snapshot.placeId||'',config:{...snapshot.config},status:'saved',updatedAt:timestamp(),updatedByUid:user.uid};}
  function createdData(data,user){return{...data,createdAt:timestamp(),createdByUid:user.uid,createdByEmail:user.email||''};}
  function switchTab(tab){const saved=tab==='saved';$('staticQrCreatePanel').classList.toggle('hidden',saved);$('staticQrSavedPanel').classList.toggle('hidden',!saved);if(saved)listen();}
  function listen(){if(unsubscribe||loading)return;if(!authorizedUi()){listState('Inicia sesión como administrador para consultar tus QR.',true);return;}loading=true;unsubscribe=collection.onSnapshot(snapshot=>{loading=false;records=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));renderList();},()=>{loading=false;unsubscribe=null;listState('No se pudieron cargar los QR. Comprueba permisos y conexión.',true);});}
  function validRecord(record){try{return bridge.validateUrl(record.url)===record.url;}catch(_){return false;}}
  function renderList(){const search=$('staticQrSearch').value.trim().toLocaleLowerCase('es'),filter=$('staticQrFilter').value;const shown=records.filter(r=>(!filter||r.destinationType===filter)&&(!search||`${r.name||''} ${r.url||''}`.toLocaleLowerCase('es').includes(search)));$('staticQrSavedCount').textContent=`${records.length} guardados`;const list=$('staticQrSavedList');list.replaceChildren();for(const record of shown){const card=document.createElement('article');card.className='static-qr-card';const detail=document.createElement('div');detail.className='min-w-0';detail.append(textNode('h4','font-black text-white truncate',record.name||'Sin nombre'),textNode('p','text-xs text-gray-400 break-all mt-1',record.url||'Sin destino'));card.append(detail);list.append(card);}listState(shown.length?`${shown.length} de ${records.length} códigos.`:'Todavía no hay QR guardados.');}
  async function save(){if(busy)return;const user=auth.currentUser;if(!authorizedUi()||!user)return state('Inicia sesión como administrador para guardar.',true);const snapshot=bridge.snapshot();if(!snapshot)return state('Genera primero un QR válido.',true);let name,data;try{name=currentName();data=recordData(snapshot,name,user,editing);}catch(error){return state(error.message,true);}busy=true;syncSave();try{if(editing)await collection.doc(editing.id).update(data);else await collection.add(createdData(data,user));editing=null;state('QR guardado correctamente.');}catch(error){state(error.code==='permission-denied'?'Firestore rechazó el guardado: falta publicar la regla de staticMarketingQrs.':'No se pudo guardar el QR.',true);}finally{busy=false;syncSave();}}
  $('staticQrCreateTab').addEventListener('click',()=>switchTab('create')); $('staticQrSavedTab').addEventListener('click',()=>switchTab('saved')); $('staticQrSearch').addEventListener('input',renderList); $('staticQrFilter').addEventListener('change',renderList); $('staticQrSave').addEventListener('click',save); $('staticQrName').addEventListener('input',syncSave);
  auth.onAuthStateChanged(user=>{if(!user){if(unsubscribe){unsubscribe();unsubscribe=null;}records=[];editing=null;renderList();state('Inicia sesión como administrador para guardar.');}syncSave();}); syncSave();
})();
