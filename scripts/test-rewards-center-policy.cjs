'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {normalizeLoyalty,assertAssigned,assertSafeEdit}=require('../functions/rewards-center-policy');
const sample={placeId:'expreso-al-sur',active:true,targetVisits:10,maxVisitsPerDay:1,rewardTitle:'Café gratis',rewardDescription:'Una vez por ciclo',rewardType:'product',rewardValidityDays:30,stock:50};
test('normaliza un programa válido sin mutar el original',()=>{const x=normalizeLoyalty(sample);assert.equal(x.targetVisits,10);assert.notEqual(x,sample)});
test('rechaza metas fuera del servicio vigente',()=>{assert.throws(()=>normalizeLoyalty({...sample,targetVisits:5}),/meta/)});
test('rechaza datos no válidos',()=>{assert.throws(()=>normalizeLoyalty({...sample,rewardType:'cash'}),/Tipo/);assert.throws(()=>normalizeLoyalty({...sample,rewardTitle:''}),/nombre/)});
test('propietario solo gestiona su parada',()=>{assert.equal(assertAssigned({role:'owner',assignedPlaceIds:['expreso-al-sur'],placeId:'expreso-al-sur'}),true);assert.throws(()=>assertAssigned({role:'owner',assignedPlaceIds:['otra'],placeId:'expreso-al-sur'}),/autorización/)});
test('ediciones incompatibles con sellos se rechazan',()=>{assert.throws(()=>assertSafeEdit(sample,{...sample,targetVisits:20},{hasProgress:true}),/sellos/)});
test('cupo no puede bajar de premios emitidos',()=>{assert.throws(()=>assertSafeEdit(sample,{...sample,stock:1},{claimedCount:2}),/cupo/)});
test('se permiten ajustes sin progreso',()=>{assert.equal(assertSafeEdit(sample,{...sample,targetVisits:20},{claimedCount:0}),true)});

test('rechaza campos numéricos vacíos y fraccionarios',()=>{assert.throws(()=>normalizeLoyalty({...sample,targetVisits:''}),/meta/);assert.throws(()=>normalizeLoyalty({...sample,maxVisitsPerDay:'1.5'}),/límite/);assert.throws(()=>normalizeLoyalty({...sample,rewardValidityDays:null}),/validez/)});
test('no acepta identidades o roles sin asignación',()=>{assert.throws(()=>assertAssigned({role:'owner',assignedPlaceIds:[],placeId:'expreso-al-sur'}),/autorización/);assert.throws(()=>assertAssigned({role:'visitor',assignedPlaceIds:['expreso-al-sur'],placeId:'expreso-al-sur'}),/autorización/)});
test('protege condiciones de premios emitidos',()=>{assert.throws(()=>assertSafeEdit(sample,{...sample,rewardTitle:'Otro premio'},{hasProgress:true}),/sellos/)});

test('encargados no pueden editar programas aunque tengan la parada asignada',()=>{assert.throws(()=>assertAssigned({role:'merchant',assignedPlaceIds:['expreso-al-sur'],placeId:'expreso-al-sur'}),/autorización/)});
