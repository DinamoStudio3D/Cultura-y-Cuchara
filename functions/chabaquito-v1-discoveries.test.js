"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {SELF_VISIT_COOLDOWN_MILLIS,assertSelfVisitCooldown,trustedEvidence}=require("./chabaquito-v1-discoveries");

const base={userId:"user-a",sourceId:"qr-1",type:"self_visit",placeId:"p1",cantonId:"loja",status:"validated",verifiedAt:1000,validationMethod:"self_visit"};

test("evidencia de otro usuario autenticado es rechazada",()=>{
  assert.throws(()=>trustedEvidence(base,"user-b","qr-1"),/Evidencia turística no válida/);
});
test("una evidencia no puede declarar otro sourceId",()=>{
  assert.throws(()=>trustedEvidence(base,"user-a","qr-2"),/Evidencia turística no válida/);
});
test("solo tipos turísticos confiables son aceptados",()=>{
  assert.throws(()=>trustedEvidence({...base,type:"manual"},"user-a","qr-1"),/Evidencia turística no válida/);
});
test("solo métodos de validación backend permitidos son aceptados",()=>{
  assert.throws(()=>trustedEvidence({...base,validationMethod:"client"},"user-a","qr-1"),/Evidencia turística no válida/);
});
test("la evidencia confiable queda ligada al usuario y origen autenticados",()=>{
  const evidence=trustedEvidence(base,"user-a","qr-1");
  assert.equal(evidence.userId,"user-a");
  assert.equal(evidence.sourceId,"qr-1");
  assert.equal(evidence.scope,"tourism_discovery");
});

const evidenceDoc=data=>({data:()=>data});

test("revisita autónoma antes de 24 horas es rechazada",()=>{
  const first={...base,verifiedAt:1000,scope:"tourism_discovery"};
  const incoming={...base,sourceId:"qr-2",verifiedAt:1000+SELF_VISIT_COOLDOWN_MILLIS-1,scope:"tourism_discovery"};
  assert.throws(()=>assertSelfVisitCooldown([evidenceDoc(first)],incoming),/después de 24 horas/);
});

test("revisita autónoma al cumplir 24 horas es aceptada",()=>{
  const first={...base,verifiedAt:1000,scope:"tourism_discovery"};
  const incoming={...base,sourceId:"qr-2",verifiedAt:1000+SELF_VISIT_COOLDOWN_MILLIS,scope:"tourism_discovery"};
  assert.equal(assertSelfVisitCooldown([evidenceDoc(first)],incoming),true);
});

test("otra parada no queda bloqueada por el cooldown",()=>{
  const first={...base,verifiedAt:1000,scope:"tourism_discovery"};
  const incoming={...base,sourceId:"qr-2",placeId:"p2",verifiedAt:1001,scope:"tourism_discovery"};
  assert.equal(assertSelfVisitCooldown([evidenceDoc(first)],incoming),true);
});


test("un segundo intento con el estado ya confirmado queda bloqueado por el cooldown",()=>{
  const committed={...base,sourceId:"qr-primer-intento",verifiedAt:1000,scope:"tourism_discovery"};
  const retried={...base,sourceId:"qr-segundo-intento",verifiedAt:1001,scope:"tourism_discovery"};
  assert.throws(()=>assertSelfVisitCooldown([evidenceDoc(committed)],retried),/después de 24 horas/);
});
