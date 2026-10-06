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

test("una visita sin identificador estable no puede sumar",()=>{
  const [state]=calculateUserMissionStates({userId:"user-1",missions:[mission],visits:[{placeId:"p1",status:"confirmed",confirmedAt:"2026-10-05T12:00:00Z"}],placesById:{}});
  assert.equal(state.current,0);
});

test("evidencia turística validada se normaliza como visita confirmada",()=>{
  const visit=evidenceFromSnapshot({id:"doc-1",data:()=>({sourceId:"qr_demo",placeId:"p1",status:"validated",verifiedAt:123})});
  assert.deepEqual(visit,{requestId:"qr_demo",placeId:"p1",status:"confirmed",confirmedAt:123,source:"chabaquito_evidence"});
});
test("evidencia turística revertida se normaliza como visita revertida",()=>{
  const visit=evidenceFromSnapshot({id:"doc-1",data:()=>({sourceId:"visit-1",placeId:"p1",status:"reversed",firstVerifiedAt:100,verifiedAt:200})});
  assert.equal(visit.status,"reversed");
  assert.equal(visit.confirmedAt,100);
});
