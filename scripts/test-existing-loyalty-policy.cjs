/* Prepared regression checks; no Firebase connection and no real records. */
'use strict';
const assert=require('node:assert/strict');
const {select,progressPatch,restorePatch,reverseSeasonClaim}=require('../functions/loyalty-season-policy');
const season={id:'festival',title:'Festival',active:true,startAt:'2026-10-01T00:00:00-05:00',endAt:'2026-11-01T00:00:00-05:00',targetVisits:10,maxVisitsPerDay:1,rewardTitle:'Café',rewardDescription:'Un café',rewardValidityDays:30,stock:20};
const program={active:true,targetVisits:20,maxVisitsPerDay:2,rewardTitle:'Nuevo premio',rewardValidityDays:30,seasons:[season],seasonClaimedCounts:{festival:5,navidad:3}};
const counter={visitCount:4,rewardCycles:0,permanentPolicy:{targetVisits:10,maxVisitsPerDay:1,rewardTitle:'Premio original'},lastVisitDay:'2026-10-24',dailyVisitCount:1,seasonalCards:{festival:{visitCount:2,rewardCycles:0,policy:{...season}},navidad:{visitCount:3}}};
const active=select(program,counter,Date.parse('2026-10-24T12:00:00-05:00'));
assert.equal(active.counter.visitCount,2);
assert.equal(active.counter.dailyVisitCount,1);
const patch=progressPatch(active,counter,3);
assert.equal(patch.visitCount,undefined,'Una temporada no sustituye el progreso habitual');
assert.equal(patch.seasonalCards.navidad.visitCount,3);
assert.equal(counter.seasonalCards.festival.visitCount,2,'No modifica el objeto de entrada');
const resumed=select(program,counter,Date.parse('2026-11-02T12:00:00-05:00'));
assert.equal(resumed.id,'permanent');
assert.equal(resumed.counter.visitCount,4);
assert.equal(resumed.program.targetVisits,10);
assert.equal(resumed.program.rewardTitle,'Premio original');
const restored=restorePatch({seasonId:'festival',previousSeasonCard:null},counter);
assert.equal(restored.seasonalCards.festival,undefined);
assert.equal(restored.seasonalCards.navidad.visitCount,3);
// Other people claimed rewards after the visit being undone. Remove only this reward.
assert.deepEqual(reverseSeasonClaim(program,'festival'),{festival:4,navidad:3});
assert.equal(program.seasonClaimedCounts.festival,5);
assert.throws(()=>reverseSeasonClaim({seasonClaimedCounts:{festival:0}},'festival'));
assert.throws(()=>reverseSeasonClaim({},'festival'));
console.log('Existing loyalty policy regression checks passed.');
