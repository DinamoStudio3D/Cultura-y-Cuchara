import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync(new URL('../merchant-dashboard.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('let dashboardGeneration=0;'),html.indexOf('function analyticsAvailable()'));
function fixture({paid=['paid'],fail='',hold=false}={}){
 const nodes=new Map(),queries=[],reads=[],releases=[];let renders=0,shown='';
 function el(id){if(!nodes.has(id)){const n={value:id==='placeFilter'?'all':'',disabled:false,classList:{toggle(){},remove(){},add(){}},textContent:'',innerHTML:''};nodes.set(id,n)}return nodes.get(id)}
 const snapshot=id=>({id,exists:true,data:()=>({title:id,id:'forged-id'})});
 const ctx={auth:{currentUser:{uid:'owner'}},merchant:{placeIds:['paid','free']},places:[],statsPlaces:[],birthdayLoadedIds:[],programs:[],counters:[],visits:[],rewards:[],webEvents:[],birthdayOffers:[],subscriptionSettings:{},el,safe:String,millis:()=>0,paidStatsEnabled:place=>paid.includes(place.id),window:{VisitaLojaSubscriptionPlans:{loadPlanSettings:async()=>({})}},loadBirthdayForm(){},render(){renders++},show:id=>shown=id,db:{collection:name=>({doc:id=>({get:async()=>{reads.push({name,id});if(hold&&name!=='locales')await new Promise(r=>releases.push(r));if(name===fail)throw Error('denied');return name==='locales'?snapshot(id):{id,exists:false}}}),where:(_field,_op,id)=>({get:async()=>{queries.push({name,id});if(hold)await new Promise(r=>releases.push(r));if(name===fail)throw Error('denied');return {docs:[]}}})})}};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,el,queries,reads,get renders(){return renders},get shown(){return shown},release(){releases.forEach(r=>r())},start:()=>ctx.loadDashboard()};
}
test('free businesses retain management and only eligible businesses are queried for statistics',async()=>{const f=fixture();await f.start();assert.deepEqual(Array.from(f.ctx.places,p=>p.id),['paid','free']);assert.deepEqual(Array.from(f.ctx.statsPlaces,p=>p.id),['paid']);assert.ok(f.queries.every(q=>q.id==='paid'));assert.equal(f.shown,'app');assert.deepEqual(Array.from(f.ctx.birthdayLoadedIds),['paid','free']);});
test('no statistics entitlement opens management without querying client activity',async()=>{const f=fixture({paid:[]});await f.start();assert.equal(f.queries.length,0);assert.equal(f.shown,'app');assert.equal(f.ctx.places.length,2);});
test('denied birthday read leaves drafts usable and blocks campaign publication',async()=>{const f=fixture({fail:'birthdayOffers'});await f.start();assert.equal(f.shown,'app');assert.equal(f.ctx.birthdayLoadedIds.length,0);assert.match(f.el('loadNotice').textContent,/Cumpleaños/);assert.equal(f.ctx.places.length,2);});
test('responses after logout never restore prior account data',async()=>{const f=fixture({hold:true});const work=f.start();for(let i=0;i<12;i++)await Promise.resolve();f.ctx.auth.currentUser=null;vm.runInContext('dashboardGeneration++',f.ctx);f.ctx.places=[];f.ctx.statsPlaces=[];const rendered=f.renders;f.release();await work;assert.equal(f.renders,rendered);assert.equal(f.ctx.birthdayLoadedIds.length,0);assert.equal(f.ctx.places.length,0);});

test('dashboard and verification agree on reward availability, and progress follows the applicable card',()=>{
 const context={window:{}};
 vm.createContext(context);
 for(const path of ['js/merchant-reward-state-v231.js','functions/loyalty-season-policy.js']){
  vm.runInContext(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),context);
 }
 const begin=html.indexOf('function statusOf(');
 vm.runInContext(html.slice(begin,html.indexOf('async function loadDashboard',begin)),context);
 assert.equal(context.statusOf({status:'pending'}).canDeliver,false);
 assert.equal(context.statusOf({status:'cancelled'}).label,'Anulado');
 assert.equal(context.statusOf({status:'pending',expiresAt:Date.now()+60000}).canDeliver,true);
 assert.equal(context.clientCardProgress({targetVisits:15},{visitCount:10,rewardCycles:0,permanentPolicy:{targetVisits:10}}).percent,100);
 const season={id:'fest',title:'Festival',rewardTitle:'Café',active:true,startAt:new Date(Date.now()-60000).toISOString(),endAt:new Date(Date.now()+60000).toISOString(),targetVisits:20};
 const current=context.clientCardProgress({targetVisits:10,seasons:[season]},{visitCount:7,seasonalCards:{fest:{visitCount:4,rewardCycles:0}}});
 assert.equal(current.target,20);
 assert.equal(current.percent,20);
});
