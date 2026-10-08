"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {LIMITS,selfVisitEvidenceId,validateProximityCoordinates}=require("./chabaquito-v1-visit-validation");

const now=Date.parse("2026-10-05T12:00:00Z");
const place={lat:-3.99313,lng:-79.20422};
const gps=(extra={})=>({latitude:place.lat,longitude:place.lng,accuracy:5,capturedAt:now,...extra});

test("acepta GPS reciente, preciso y dentro del radio",()=>assert.equal(validateProximityCoordinates({place,coordinates:gps(),now}),true));
test("rechaza coordenadas fuera del radio permitido",()=>assert.throws(()=>validateProximityCoordinates({place,coordinates:gps({latitude:place.lat+0.001}),now}),/Fuera del radio/));
test("rechaza precisión GPS peor al límite",()=>assert.throws(()=>validateProximityCoordinates({place,coordinates:gps({accuracy:LIMITS.accuracyMeters+0.1}),now}),/GPS inválido/));
test("rechaza una lectura GPS antigua",()=>assert.throws(()=>validateProximityCoordinates({place,coordinates:gps({capturedAt:now-LIMITS.maxAgeMillis-1}),now}),/GPS inválido/));
test("rechaza una lectura GPS fechada en el futuro",()=>assert.throws(()=>validateProximityCoordinates({place,coordinates:gps({capturedAt:now+1}),now}),/GPS inválido/));
test("rechaza latitud o longitud imposibles",()=>assert.throws(()=>validateProximityCoordinates({place,coordinates:gps({latitude:91}),now}),/GPS inválido/));
test("rechaza precisión cero o negativa",()=>assert.throws(()=>validateProximityCoordinates({place,coordinates:gps({accuracy:0}),now}),/GPS inválido/));
test("acepta exactamente el límite de precisión de 20 metros",()=>assert.equal(validateProximityCoordinates({place,coordinates:gps({accuracy:LIMITS.accuracyMeters}),now}),true));
test("acepta una lectura con exactamente 30 segundos de antigüedad",()=>assert.equal(validateProximityCoordinates({place,coordinates:gps({capturedAt:now-LIMITS.maxAgeMillis}),now}),true));
test("rechaza una parada con coordenadas configuradas fuera de rango",()=>assert.throws(()=>validateProximityCoordinates({place:{lat:-91,lng:place.lng},coordinates:gps(),now}),/GPS inválido/));
test("rechaza precisión GPS no numérica",()=>assert.throws(()=>validateProximityCoordinates({place,coordinates:gps({accuracy:"5"}),now}),/GPS inválido/));



test("cada visita autónoma aceptada recibe identidad backend distinta",()=>{
  assert.notEqual(selfVisitEvidenceId("qr-demo",now),selfVisitEvidenceId("qr-demo",now+1));
});

test("dos QR distintos nunca comparten identidad de visita autónoma",()=>{
  assert.notEqual(selfVisitEvidenceId("qr-a",now),selfVisitEvidenceId("qr-b",now));
});
