'use strict';
const core=require('../js/chabaquito-v1-core');
const VERSION=1;
function documentId(key){return Buffer.from(String(key),'utf8').toString('base64url');}
function references(db,uid){const profile=db.collection(core.COLLECTIONS.profiles).doc(uid);return{profile,evidence:profile.collection(core.COLLECTIONS.evidence),events:profile.collection(core.COLLECTIONS.xpEvents),progress:profile.collection(core.COLLECTIONS.adventures).doc(core.PILOT.id)};}
function readEvents(snapshot){const seen=new Map();return snapshot.docs.map(doc=>{const data=doc.data(),id=data.id||data.eventId||doc.id;if(data.id&&data.eventId&&data.id!==data.eventId)throw new Error('Identificador XP inconsistente.');if(seen.has(id))throw new Error('Evento XP duplicado: requiere revisión antes de escribir.');seen.set(id,true);if(!Number.isSafeInteger(data.xp)||data.xp<0||!['granted','revoked'].includes(data.status))throw new Error('Evento XP no válido.');return{...data,id};});}
function eventReference(events,snapshot,id){const existing=snapshot.docs.find(doc=>(doc.data().id||doc.data().eventId||doc.id)===id);return events.doc(existing?existing.id:documentId(id));}
function writeEvents(tx,events,snapshot,delta,now){for(const[items,status]of[[delta.grant,'granted'],[delta.revoke,'revoked']])for(const event of items)tx.set(eventReference(events,snapshot,event.id),{...event,eventId:event.id,schemaVersion:VERSION,status,updatedAt:now},{merge:true});}
module.exports={VERSION,documentId,references,readEvents,writeEvents};
