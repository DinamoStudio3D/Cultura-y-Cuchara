/* Persistencia segura para QR dinámicos de marketing. No toca QR de visitas/pasaporte/fidelidad. */
(() => {
  'use strict';

  // Punto de entrada ya cargado por admin.html: activa módulos aislados sin reescribir el HTML principal.
  if (!document.querySelector('script[src="js/admin-module-isolation.js"]')) {
    const moduleIsolation = document.createElement('script');
    moduleIsolation.src = 'js/admin-module-isolation.js';
    moduleIsolation.defer = true;
    document.head.append(moduleIsolation);
  }
  if (!document.querySelector('script[src="js/admin-self-checkin-bootstrap.js"]')) {
    const selfCheckinBootstrap = document.createElement('script');
    selfCheckinBootstrap.src = 'js/admin-self-checkin-bootstrap.js';
    selfCheckinBootstrap.defer = true;
    document.head.append(selfCheckinBootstrap);
  }
  if (!document.querySelector('script[src="js/admin-business-access-ui.js"]')) {
    const businessAccessUi = document.createElement('script');
    businessAccessUi.src = 'js/admin-business-access-ui.js';
    businessAccessUi.defer = true;
    document.head.append(businessAccessUi);
  }
  if (!document.querySelector('script[src="js/admin-places-organizer.js"]')) {
    const placesOrganizer = document.createElement('script');
    placesOrganizer.src = 'js/admin-places-organizer.js';
    placesOrganizer.defer = true;
    document.head.append(placesOrganizer);
  }

  const PRIVATE_COLLECTION = 'dynamicMarketingQrs';
  const PUBLIC_COLLECTION = 'dynamicQrPublic';
  const HISTORY_COLLECTION = 'dynamicQrHistory';
  const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
  const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();

  function requireUser() { const user = auth.currentUser; if (!user) throw new Error('AUTH_REQUIRED'); return user; }
  function validId(value) { const id=String(value||'').trim(); if(!ID_RE.test(id)) throw new Error('INVALID_QR_ID'); return id; }
  function validDestination(value) { let url; try{url=new URL(String(value||'').trim());}catch(_){throw new Error('INVALID_DESTINATION');} if(url.protocol!=='https:'||url.username||url.password||url.href.length>1800)throw new Error('INVALID_DESTINATION'); return url.href; }
  function cleanName(value){const name=String(value||'').trim();if(!name||name.length>80)throw new Error('INVALID_NAME');return name;}
  function cleanStatus(value){if(!['active','inactive'].includes(value))throw new Error('INVALID_STATUS');return value;}
  function cleanType(value){const allowed=['manual','home','place','routes','passport','agenda','shop','signup'];return allowed.includes(value)?value:'manual';}
  function publicUrl(qrId){return `https://www.visitaloja.com/q/${encodeURIComponent(validId(qrId))}`;}
  function historyRef(db,qrId){return db.collection(HISTORY_COLLECTION).doc(`${qrId}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`);}
  function historyData(qrId,action,previousDestinationUrl,destinationUrl,previousStatus,status,user){return{qrId,action,previousDestinationUrl:previousDestinationUrl||'',destinationUrl,previousStatus:previousStatus||'',status,actorUid:user.uid,actorEmail:user.email||'',createdAt:serverTimestamp()};}

  async function create(input){
    const user=requireUser(),qrId=validId(input.qrId),destinationUrl=validDestination(input.destinationUrl),status=cleanStatus(input.status||'active'),name=cleanName(input.name),dbx=db;
    const privateRef=dbx.collection(PRIVATE_COLLECTION).doc(qrId),publicRef=dbx.collection(PUBLIC_COLLECTION).doc(qrId);
    await dbx.runTransaction(async tx=>{const [privateSnap,publicSnap]=await Promise.all([tx.get(privateRef),tx.get(publicRef)]);if(privateSnap.exists||publicSnap.exists)throw new Error('QR_ID_EXISTS');const now=serverTimestamp();tx.set(privateRef,{name,destinationUrl,destinationType:cleanType(input.destinationType),placeId:String(input.placeId||'').slice(0,200),status,config:input.config&&typeof input.config==='object'?input.config:{},createdAt:now,updatedAt:now,createdByUid:user.uid,createdByEmail:user.email||'',updatedByUid:user.uid});tx.set(publicRef,{destinationUrl,status,updatedAt:now});tx.set(historyRef(dbx,qrId),historyData(qrId,'created','',destinationUrl,'',status,user));});
    return{qrId,publicUrl:publicUrl(qrId),destinationUrl,status};
  }

  async function update(qrIdValue,changes){
    const user=requireUser(),qrId=validId(qrIdValue),dbx=db,privateRef=dbx.collection(PRIVATE_COLLECTION).doc(qrId),publicRef=dbx.collection(PUBLIC_COLLECTION).doc(qrId);
    return dbx.runTransaction(async tx=>{const [privateSnap,publicSnap]=await Promise.all([tx.get(privateRef),tx.get(publicRef)]);if(!privateSnap.exists||!publicSnap.exists)throw new Error('QR_NOT_FOUND');const old=privateSnap.data(),oldPublic=publicSnap.data();if(old.destinationUrl!==oldPublic.destinationUrl||old.status!==oldPublic.status)throw new Error('QR_STATE_MISMATCH');const destinationUrl=changes.destinationUrl===undefined?old.destinationUrl:validDestination(changes.destinationUrl),status=changes.status===undefined?old.status:cleanStatus(changes.status),name=changes.name===undefined?old.name:cleanName(changes.name),changedDestination=destinationUrl!==old.destinationUrl,changedStatus=status!==old.status,now=serverTimestamp();tx.update(privateRef,{name,destinationUrl,status,updatedAt:now,updatedByUid:user.uid});tx.update(publicRef,{destinationUrl,status,updatedAt:now});if(changedDestination||changedStatus){const action=changedDestination?'destination_changed':(status==='active'?'activated':'deactivated');tx.set(historyRef(dbx,qrId),historyData(qrId,action,old.destinationUrl,destinationUrl,old.status,status,user));}return{qrId,publicUrl:publicUrl(qrId),destinationUrl,status,name};});
  }
  async function setActive(qrId,active){return update(qrId,{status:active?'active':'inactive'});}

  window.visitaLojaDynamicQrStore=Object.freeze({create,update,setActive,publicUrl,validateId:validId,validateDestination:validDestination,collections:Object.freeze({private:PRIVATE_COLLECTION,public:PUBLIC_COLLECTION,history:HISTORY_COLLECTION})});
})();
