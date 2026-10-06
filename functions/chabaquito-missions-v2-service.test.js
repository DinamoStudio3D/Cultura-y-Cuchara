"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {buildPersistencePlan,calculateUserMissionStates,evidenceFromSnapshot}=require("./chabaquito-missions-v2-service");

const mission={id:"mision-01",status:"active",type:"total_visits",targetCount:1,badge:{title:"Explorador"},rewardType:"digital"};

test("completar crea una recompensa una sola vez",()=>{
  const [state]=calculateUserMissionStates({userId:"user-1",missions:[mission],visits:[{requestId:"visit-1",placeId:"p1",status:"confirmed",confirmedAt:"2026-10-05T12:00:00Z"}],placesById:{}});
  const first=buildPersistencePlan(state,{},"now-1");
  assert.equal(first.rewardAction,"create");
  const repeated=buildPersistencePlan(state,{progress:first.progressData,reward:first.rewardData},"now-2");
  assert.equal(repeated.rewardAction,"none");
  assert.equal(repeated.progressData.completedAt,"now-1");
});

test("revertir una visita revoca progreso y recompensa",()=>{
  const [state]=calculateUserMissionStates({userId:"user-1",missions:[mission],visits:[{requestId:"visit-1",placeId:"p1",status:"reversed",confirmedAt:"2026-10-05T12:00:00Z"}],placesById:{}});
  const plan=buildPersistencePlan(state,{progress:{completed:true,completedAt:"before"},reward:{missionId:"mision-01"}},"now");
  assert.equal(state.current,0);
  assert.equal(state.completed,false);
  assert.equal(plan.rewardAction,"delete");
  assert.equal(plan.progressData.completedAt,null);
});

test("reintentar una reversión no intenta borrar dos veces la recompensa",()=>{
  const [state]=calculateUserMissionStates({userId:"user-1",missions:[mission],visits:[{requestId:"visit-1",placeId:"p1",status:"reversed",confirmedAt:100}],placesById:{}});
  const first=buildPersistencePlan(state,{progress:{completed:true,completedAt:"before"},reward:{missionId:"mision-01"}},"now-1");
  assert.equal(first.rewardAction,"delete");
  const repeated=buildPersistencePlan(state,{progress:first.progressData,reward:null},"now-2");
  assert.equal(repeated.rewardAction,"none");
  assert.equal(repeated.progressData.current,0);
  assert.equal(repeated.progressData.completed,false);
  assert.equal(repeated.progressData.completedAt,null);
});

test("reintentar una confirmación completada conserva una sola recompensa",()=>{
  const [state]=calculateUserMissionStates({userId:"user-1",missions:[mission],visits:[{requestId:"visit-1",placeId:"p1",status:"confirmed",confirmedAt:100}],placesById:{}});
  const first=buildPersistencePlan(state,{},"now-1");
  const retry1=buildPersistencePlan(state,{progress:first.progressData,reward:first.rewardData},"now-2");
  const retry2=buildPersistencePlan(state,{progress:retry1.progressData,reward:first.rewardData},"now-3");
  assert.equal(first.rewardAction,"create");
  assert.equal(retry1.rewardAction,"none");
  assert.equal(retry2.rewardAction,"none");
  assert.equal(retry2.progressData.completedAt,"now-1");
});

test("confirmada y luego revertida con el mismo requestId termina sin progreso",()=>{
  const [state]=calculateUserMissionStates({userId:"user-1",missions:[mission],visits:[
    {requestId:"visit-1",placeId:"p1",status:"confirmed",confirmedAt:100},
    {requestId:"visit-1",placeId:"p1",status:"reversed",confirmedAt:100}
  ],placesById:{}});
  assert.equal(state.current,0);
  assert.equal(state.completed,false);
});

test("una visita sin identificador estable no puede sumar",()=>{
  const [state]=calculateUserMissionStates({userId:"user-1",missions:[mission],visits:[{placeId:"p1",status:"confirmed",confirmedAt:"2026-10-05T12:00:00Z"}],placesById:{}});
  assert.equal(state.current,0);
});

test("evidencia turística validada se normaliza como visita confirmada",()=>{
  const visit=evidenceFromSnapshot({id:"doc-1",data:()=>({scope:"tourism_discovery",type:"self_visit",validationMethod:"self_visit",sourceId:"qr_demo",placeId:"p1",status:"validated",verifiedAt:123})});
  assert.deepEqual(visit,{requestId:"demo",placeId:"p1",status:"confirmed",confirmedAt:123,source:"chabaquito_evidence"});
});
test("evidencia turística revertida se normaliza como visita revertida",()=>{
  const visit=evidenceFromSnapshot({id:"doc-1",data:()=>({scope:"tourism_discovery",type:"confirmed_visit",validationMethod:"staff_confirmation",sourceId:"visit-1",placeId:"p1",status:"reversed",firstVerifiedAt:100,verifiedAt:200})});
  assert.equal(visit.status,"reversed");
  assert.equal(visit.confirmedAt,100);
});

test("el prefijo técnico qr_ no crea una segunda identidad de visita",()=>{
  const visit=evidenceFromSnapshot({id:"doc-1",data:()=>({scope:"tourism_discovery",type:"self_visit",validationMethod:"self_visit",sourceId:"qr_visit-1",placeId:"p1",status:"validated",verifiedAt:123})});
  assert.equal(visit.requestId,"visit-1");
});

test("dos visitas con el mismo origen producen un solo avance",()=>{
  const [state]=calculateUserMissionStates({userId:"user-1",missions:[{...mission,targetCount:2}],visits:[
    {requestId:"same-source",placeId:"p1",status:"confirmed",confirmedAt:100},
    {requestId:"same-source",placeId:"p1",status:"confirmed",confirmedAt:101}
  ],placesById:{}});
  assert.equal(state.current,1);
  assert.equal(state.completed,false);
});

test("solo una finalización nueva se marca como creación de recompensa",()=>{
  const [state]=calculateUserMissionStates({userId:"user-1",missions:[mission],visits:[{requestId:"v1",placeId:"p1",status:"confirmed",confirmedAt:100}],placesById:{}});
  const first=buildPersistencePlan(state,{},"now-1");
  const repeated=buildPersistencePlan(state,{progress:first.progressData,reward:first.rewardData},"now-2");
  assert.equal(first.rewardAction,"create");
  assert.equal(repeated.rewardAction,"none");
});

test("evidencia no confiable no entra al progreso de misiones",()=>{
  const invalid=[
    {scope:"tourism_discovery",type:"fake_visit",status:"validated",validationMethod:"self_visit",sourceId:"x",placeId:"p1"},
    {scope:"tourism_discovery",type:"self_visit",status:"pending",validationMethod:"self_visit",sourceId:"x",placeId:"p1"},
    {scope:"tourism_discovery",type:"self_visit",status:"validated",validationMethod:"client",sourceId:"x",placeId:"p1"}
  ];
  for(const data of invalid) assert.equal(evidenceFromSnapshot({id:"x",data:()=>data}),null);
});
