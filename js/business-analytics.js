/* Shared event collection and plan windows. No personal data is collected here. */
(function(global){
'use strict';
const DAY=86400000,TYPES=new Set(['view','directions','favorite','stamp','promo','whatsapp','product','benefit']);
let plans=null,loading;
async function load(db){if(plans!==null)return;if(!loading)loading=db.collection('settings').doc('subscriptions').get().then(s=>configure(s.exists?s.data().plans:[])).catch(e=>{loading=null;throw e});return loading;}
function configure(items){plans=(Array.isArray(items)?items:[]).map(p=>global.VisitaLojaPlanOffer.upgrade(p));}
function months(place){const id=global.VisitaLojaPlanOffer.id(place?.subscription?.plan),spec=global.VisitaLojaPlanOffer.spec(id);if(!spec||!spec.months)return 0;const p=plans?.find(p=>global.VisitaLojaPlanOffer.id(p.id)===id);if(p?.active===false||p?.features?.stats===false)return 0;return Math.max(0,Math.min(36,Number(p?.features?.analyticsPeriodMonths??spec.months)||0));}
function eligible(place,now=Date.now()){return !!place&&place.active!==false&&(!place.publicationStatus||place.publicationStatus==='published')&&['active','trial'].includes(place.subscription?.status||'active')&&global.VisitaLojaPlanOffer.active(place,now)&&months(place)>0;}
function days(n){return n===12?365:n*30;}
function cutoff(n,now=Date.now()){if(!n)return Infinity;const local=new Date(now-5*3600000);return Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())+5*3600000-(days(n)-1)*DAY;}
function time(v){if(v?.toMillis)return v.toMillis();if(v?.seconds!=null)return v.seconds*1000;return new Date(v||0).getTime()||0;}
function date(v,end=false){if(!v)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(String(v)))return new Date(v+(end?'T23:59:59.999-05:00':'T00:00:00-05:00'));const ms=time(v);return ms?new Date(ms):null;}
function entitlement(place){const s=place?.subscription||{};return{analyticsEnabled:months(place)>0&&place?.active!==false&&(!place?.publicationStatus||place.publicationStatus==='published')&&['active','trial'].includes(s.status||'active'),analyticsPeriodMonths:months(place),subscriptionStartsAt:date(s.startAt||s.startDate),subscriptionEndsAt:date(s.endAt||s.endDate,true)};}
function tracker({db,storage=global.sessionStorage,now=Date.now,random=Math.random,serverTimestamp=()=>global.firebase.firestore.FieldValue.serverTimestamp(),warn=console.warn}={}){
 const sent=new Set(),pending=new Set();let session;
 function read(k){try{return storage?.getItem(k)}catch(_){return null}}
 function save(k,v){try{storage?.setItem(k,v)}catch(_){}}
 session=read('vl_business_session_v2')||`visit_${now()}_${random().toString(36).slice(2,12)}`;save('vl_business_session_v2',session);
 return async function track(place,type){
  if(!db||!TYPES.has(type)||!place?.id)return false;
  try{await load(db)}catch(error){warn('[VisitaLoja] No se pudo consultar el permiso de estadísticas',error?.code||'unavailable');return false;}
  if(!eligible(place,now()))return false;
  const key=`vl_event_v2_${session}_${place.id}_${type}`,once=type==='view';
  if(pending.has(key)||(once&&(sent.has(key)||read(key))))return false;
  pending.add(key);
  try{await db.collection('businessEvents').add({placeId:place.id,type,sessionId:session,createdAt:serverTimestamp()});if(once){sent.add(key);save(key,'1')}return true;}
  catch(error){warn('[VisitaLoja] No se pudo registrar la interacción',error?.code||'unavailable');return false;}
  finally{pending.delete(key)}
 };
}
global.VisitaLojaBusinessAnalytics=Object.freeze({configure,months,eligible,days,cutoff,time,date,entitlement,tracker});
})(window);
