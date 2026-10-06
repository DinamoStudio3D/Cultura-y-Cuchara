"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {trustedEvidence}=require("./chabaquito-v1-discoveries");

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
