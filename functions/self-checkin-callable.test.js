"use strict";

const assert = require("node:assert/strict");
const { createSelfCheckinHandler } = require("./self-checkin-callable");

class HttpsError extends Error { constructor(code,message){ super(message); this.code=code; } }
const Timestamp={ now:()=>({now:true}), fromDate:d=>({date:d}) };
function snap(exists,id,data={}){ return {exists,id,data:()=>data}; }

function makeDb(place){
  const writes=[];
  const db={
    collection(name){ return { doc(id){ return {
      key:`${name}/${id}`,
      async get(){ if(name==="locales") return snap(Boolean(place),id,place||{}); throw new Error("unexpected direct get"); }
    }; } }; },
    async runTransaction(fn){ return fn({
      async get(ref){
        if(ref.key.startsWith("selfCheckinVisits/")) return snap(false,ref.key);
        if(ref.key==="siteContent/passport") return snap(true,"passport",{campaignId:"camp"});
        if(ref.key.startsWith("securePassportStamps/")) return snap(false,ref.key);
        throw new Error(`unexpected tx read ${ref.key}`);
      },
      create(ref,data){ writes.push({key:ref.key,data}); }
    }); }
  };
  return {db,writes};
}

(async()=>{
  let syncs=0;
  const base={id:"p1",name:"Museo",validationMode:"self_checkin",selfCheckinQrToken:"secret-qr",status:"published",active:true};
  const {db,writes}=makeDb(base);
  const handler=createSelfCheckinHandler({db,Timestamp,HttpsError,safeSyncUserMissionsV2:async()=>{syncs++;},now:()=>new Date("2026-09-29T18:00:00Z")});
  const ok=await handler({auth:{uid:"u1"},data:{placeId:"p1",qrToken:"secret-qr"}});
  assert.equal(ok.registered,true); assert.equal(ok.passportAdded,true); assert.equal(syncs,1); assert.equal(writes.length,2);

  await assert.rejects(()=>handler({data:{placeId:"p1",qrToken:"secret-qr"}}),e=>e.code==="unauthenticated");
  await assert.rejects(()=>handler({auth:{uid:"u1"},data:{placeId:"p1",qrToken:"wrong"}}),e=>e.code==="permission-denied");

  const merchant=makeDb({...base,validationMode:"merchant_confirmation"});
  const merchantHandler=createSelfCheckinHandler({db:merchant.db,Timestamp,HttpsError,safeSyncUserMissionsV2:async()=>{}});
  await assert.rejects(()=>merchantHandler({auth:{uid:"u1"},data:{placeId:"p1",qrToken:"secret-qr"}}),e=>e.code==="failed-precondition");

  const missing=makeDb(null);
  const missingHandler=createSelfCheckinHandler({db:missing.db,Timestamp,HttpsError,safeSyncUserMissionsV2:async()=>{}});
  await assert.rejects(()=>missingHandler({auth:{uid:"u1"},data:{placeId:"p1",qrToken:"secret-qr"}}),e=>e.code==="not-found");

  console.log("self-checkin callable tests: OK");
})().catch(e=>{console.error(e);process.exit(1);});
