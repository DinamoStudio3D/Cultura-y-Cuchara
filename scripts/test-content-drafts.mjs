import assert from 'node:assert/strict';
import {test} from 'node:test';
import '../js/admin-content-drafts.js';
const drafts=globalThis.VisitaLojaContentDrafts;
function storage(){const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data};}
test('drafts survive rereading without public writes and are separated by account and module',()=>{
 const db=storage(),content={blocks:{footerContact:{instagramUrl:'',title:'Pendiente'}}};
 const record=drafts.save(db,'admin','home-content',content,1000);
 assert.deepEqual(drafts.load(db,'admin','home-content'),record);
 assert.equal(drafts.load(db,'other','home-content'),null);
 assert.equal(drafts.load(db,'admin','section-content-time'),null);
 assert.throws(()=>drafts.save(db,null,'home-content',content),/Inicia sesión/);
});
test('quota failure, oversize and corrupt drafts fail explicitly and preserve the last saved value',()=>{
 const db=storage(),data={blocks:{}};drafts.save(db,'admin','home-content',data);
 const previous=[...db.data.values()][0];
 assert.throws(()=>drafts.save(db,'admin','home-content',{blocks:{text:'x'.repeat(300000)}}),/espacio/);
 assert.equal([...db.data.values()][0],previous);
 assert.throws(()=>drafts.save({setItem(){throw Error('QuotaExceeded');}},'admin','home-content',data),/QuotaExceeded/);
 const k=[...db.data.keys()][0];db.data.set(k,'{broken');assert.throws(()=>drafts.load(db,'admin','home-content'),/leer/);
 db.data.set(k,JSON.stringify({version:1,uid:'other',scope:'home-content',savedAt:1,data}));assert.throws(()=>drafts.load(db,'admin','home-content'),/válido/);
});
