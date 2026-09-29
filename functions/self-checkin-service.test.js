"use strict";

const assert = require("node:assert/strict");
const { selfCheckinId, qrFingerprint, registerSelfCheckin } = require("./self-checkin-service");

assert.equal(selfCheckinId({ userId:"u1", placeId:"p1", day:"2026-09-29" }), "self_u1_p1_2026-09-29");
assert.equal(qrFingerprint("abc"), qrFingerprint("abc"));
assert.notEqual(qrFingerprint("abc"), qrFingerprint("def"));

function snap(exists, data={}) { return { exists, data:()=>data }; }

(async()=>{
  const writes=[];
  const refs={};
  const db={
    collection(name){ return { doc(id){ const key=`${name}/${id}`; return refs[key] ||= { key }; } }; },
    async runTransaction(fn){
      const tx={
        async get(ref){
          if(ref.key.startsWith("selfCheckinVisits/")) return snap(false);
          if(ref.key === "siteContent/passport") return snap(true,{campaignId:"camp-1"});
          if(ref.key.startsWith("securePassportStamps/")) return snap(false);
          throw new Error(`unexpected read ${ref.key}`);
        },
        create(ref,data){ writes.push({type:"create",key:ref.key,data}); }
      };
      return fn(tx);
    }
  };
  const Timestamp={ fromDate:d=>({iso:d.toISOString()}) };
  const result=await registerSelfCheckin({deps:{db,Timestamp},userId:"u1",place:{id:"p1",name:"Museo",validationMode:"self_checkin"},qrToken:"qr-1",now:new Date("2026-09-29T15:00:00Z")});
  assert.equal(result.alreadyRegistered,false);
  assert.equal(result.passportAdded,true);
  assert.equal(writes.length,2);
  assert.ok(writes.some(w=>w.key.startsWith("selfCheckinVisits/")));
  assert.ok(writes.some(w=>w.key.startsWith("securePassportStamps/")));
  assert.ok(!writes.some(w=>w.key.startsWith("loyaltyCounters/") || w.key.startsWith("loyaltyVisits/") || w.key.startsWith("loyaltyRewardClaims/")));

  const duplicateDb={
    collection(name){ return { doc(id){ return {key:`${name}/${id}`}; } }; },
    async runTransaction(fn){
      return fn({
        async get(ref){
          if(ref.key.startsWith("selfCheckinVisits/")) return snap(true,{userId:"u1"});
          if(ref.key === "siteContent/passport") return snap(true,{campaignId:"camp-1"});
          throw new Error(`duplicate flow should stop before ${ref.key}`);
        },
        create(){ throw new Error("duplicate must not write"); }
      });
    }
  };
  const duplicate=await registerSelfCheckin({deps:{db:duplicateDb,Timestamp},userId:"u1",place:{id:"p1",validationMode:"self_checkin"},now:new Date("2026-09-29T16:00:00Z")});
  assert.equal(duplicate.alreadyRegistered,true);

  await assert.rejects(()=>registerSelfCheckin({deps:{db,Timestamp},userId:"u1",place:{id:"p1",validationMode:"merchant_confirmation"}}),/requiere validación de encargado/);

  console.log("self-checkin service tests: OK");
})().catch(error=>{console.error(error);process.exit(1);});
