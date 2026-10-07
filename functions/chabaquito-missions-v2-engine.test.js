"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {calculateMissionProgress}=require("./chabaquito-missions-v2-engine");

const places={
  p1:{category:"Museo",canton:"Loja"},
  p2:{category:"Museo",canton:"Loja"},
  p3:{category:"Café",canton:"Catamayo"}
};
const mission=(type,targetCount=2,extra={})=>({status:"active",type,targetCount,...extra});
const visit=(requestId,placeId,status="confirmed",confirmedAt="2026-10-05T12:00:00Z")=>({requestId,placeId,status,confirmedAt});

test("solo las visitas confirmadas suman",()=>{
  assert.equal(calculateMissionProgress(mission("total_visits"),[visit("a","p1"),visit("b","p2","pending")],places).count,1);
});
test("una visita revertida deja de contar",()=>{
  assert.equal(calculateMissionProgress(mission("total_visits"),[visit("a","p1","reversed")],places).count,0);
});
test("la misma visita no duplica progreso",()=>{
  assert.equal(calculateMissionProgress(mission("total_visits"),[visit("a","p1"),visit("a","p1")],places).count,1);
});
test("lugares específicos cuentan lugares únicos permitidos",()=>{
  assert.equal(calculateMissionProgress(mission("place_visits",2,{placeIds:["p1","p2"]}),[visit("a","p1"),visit("b","p1"),visit("c","p2")],places).count,2);
});
test("categorías cuentan lugares únicos de categorías permitidas",()=>{
  assert.equal(calculateMissionProgress(mission("category_visits",2,{categoryIds:["museo"]}),[visit("a","p1"),visit("b","p2"),visit("c","p3")],places).count,2);
});
test("cantones cuentan cantones únicos permitidos",()=>{
  assert.equal(calculateMissionProgress(mission("canton_visits",2,{cantonIds:["loja","catamayo"]}),[visit("a","p1"),visit("b","p2"),visit("c","p3")],places).count,2);
});

test("misiones de cantón priorizan cantonId canónico",()=>{
  const canonicalPlaces={
    p1:{category:"Museo",cantonId:"loja",canton:"Nombre legado distinto"},
    p2:{category:"Museo",cantonId:"catamayo",canton:"Otro nombre legado"}
  };
  assert.equal(calculateMissionProgress(mission("canton_visits",2,{cantonIds:["loja","catamayo"]}),[visit("a","p1"),visit("b","p2")],canonicalPlaces).count,2);
});

test("una visita fuera de la ventana temporal no suma",()=>{
  assert.equal(calculateMissionProgress({...mission("total_visits"),startsAt:"2026-10-06T00:00:00Z"},[visit("a","p1")],places).count,0);
});

test("visitas totales permiten dos visitas legítimas distintas al mismo lugar",()=>{
  assert.equal(calculateMissionProgress(mission("total_visits",2),[visit("a","p1"),visit("b","p1")],places).count,2);
});
test("misión de lugares no permite completar repitiendo el mismo lugar",()=>{
  assert.equal(calculateMissionProgress(mission("place_visits",2,{placeIds:["p1","p2"]}),[visit("a","p1"),visit("b","p1")],places).count,1);
});
test("misión de categoría exige lugares distintos aunque se repita la visita",()=>{
  assert.equal(calculateMissionProgress(mission("category_visits",2,{categoryIds:["museo"]}),[visit("a","p1"),visit("b","p1")],places).count,1);
});
test("misión de cantones exige cantones distintos aunque haya varias visitas",()=>{
  assert.equal(calculateMissionProgress(mission("canton_visits",2,{cantonIds:["loja","catamayo"]}),[visit("a","p1"),visit("b","p2")],places).count,1);
});


test("una misión total_visits ignora visitas sin fecha confirmada válida",()=>{
  const m=mission("total_visits",1);
  const result=calculateMissionProgress(m,[{requestId:"sin-fecha",placeId:"p1",status:"confirmed",confirmedAt:null}],places);
  assert.equal(result.count,0);
  assert.equal(result.completed,false);
});


test("el backend rechaza metas de misión inválidas aunque Firestore contenga datos corruptos",()=>{
  for(const targetCount of [0,-1,1.5,501,NaN]){
    assert.throws(()=>calculateMissionProgress({status:"active",type:"total_visits",targetCount},[visit("a","p1")],places),/Meta de misión no válida/);
  }
});


test("una visita exactamente al inicio o fin de la ventana de misión sí cuenta",()=>{
  const m={...mission("total_visits",2),startsAt:"2026-10-05T12:00:00Z",endsAt:"2026-10-05T13:00:00Z"};
  const result=calculateMissionProgress(m,[
    visit("inicio","p1","confirmed","2026-10-05T12:00:00Z"),
    visit("fin","p2","confirmed","2026-10-05T13:00:00Z")
  ],places);
  assert.equal(result.count,2);
  assert.equal(result.completed,true);
});

test("una visita posterior al cierre de la misión no cuenta",()=>{
  const m={...mission("total_visits",1),endsAt:"2026-10-05T13:00:00Z"};
  assert.equal(calculateMissionProgress(m,[visit("tarde","p1","confirmed","2026-10-05T13:00:00.001Z")],places).count,0);
});


test("misiones pausadas, borrador o archivadas nunca suman progreso",()=>{
  for(const status of ["paused","draft","archived"]){
    const result=calculateMissionProgress({status,type:"total_visits",targetCount:1},[visit("a","p1")],places);
    assert.equal(result.count,0);
    assert.equal(result.completed,false);
  }
});

test("una visita con estado desconocido nunca suma progreso",()=>{
  const result=calculateMissionProgress(mission("total_visits",1),[visit("a","p1","validated")],places);
  assert.equal(result.count,0);
  assert.equal(result.completed,false);
});
