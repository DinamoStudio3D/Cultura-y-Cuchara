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
