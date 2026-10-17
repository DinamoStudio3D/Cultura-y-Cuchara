import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
function fixture(){const window={};vm.runInNewContext(fs.readFileSync(new URL('js/plan-offer.js',root),'utf8'),{window});return window;}
test('legacy plans adopt agreed prices, photo limits, history, loyalty, video and separate menus',()=>{
 const {VisitaLojaPlanOffer:api}=fixture();
 for(const [id,price,photos,products,months] of [['free',0,3,0,0],['impulse',10,10,0,1],['featured',30,15,10,3],['premium',60,20,20,12]]){
  const old={id,monthly:999,features:{maxGalleryImages:6,video:false,menu:true},benefits:['Menú o catálogo digital']};
  const p=api.upgrade(old);assert.equal(old.monthly,999);assert.equal(p.monthly,price);assert.equal(p.annual,price*10);assert.equal(p.features.maxGalleryImages,photos);assert.equal(p.features.maxFeaturedProducts,products);assert.equal(p.features.analyticsPeriodMonths,months);assert.equal(p.features.loyalty,true);assert.equal(p.features.menuImageQr,price>0);assert.equal(p.features.video,price>0);assert.equal(p.features.stats,price>0);assert.equal(p.features.menu,products>0);
  assert(p.benefits.some(x=>x.includes('Tarjeta de fidelidad')));assert(p.benefits.some(x=>x.includes(`Hasta ${photos} fotografías`)));
  assert.equal(p.benefits.some(x=>x.includes('jornada mensual')),id==='premium');
  assert.deepEqual(JSON.parse(JSON.stringify(api.upgrade(p))),JSON.parse(JSON.stringify(p)));
 }
});
test('versioned administrator edits remain effective and descriptions follow configured limits',()=>{
 const api=fixture().VisitaLojaPlanOffer,p=api.upgrade({id:'featured'});p.monthly=32;p.features.maxGalleryImages=17;p.features.maxFeaturedProducts=12;p.features.analyticsPeriodMonths=4;
 const next=api.upgrade(p);assert.equal(next.monthly,32);assert(next.benefits.some(x=>x.includes('17 fotografías')));assert(next.benefits.some(x=>x.includes('12 productos')));assert(next.benefits.some(x=>x.includes('4 meses')));
 api.configure([next]);assert.equal(api.productLimit({subscription:{plan:'featured'}}),12);
});
test('public products respect tier, activation, dates and cap without deleting saved data',()=>{
 const api=fixture().VisitaLojaPlanOffer,menu={active:true,dishes:Array.from({length:25},(_,i)=>({name:'Product '+i,price:'$1'}))};
 for(const [plan,count] of [['free',0],['impulse',0],['featured',10],['premium',20]]){
  const place={menu,subscription:{plan,benefits:{menu:true}}};assert.equal(api.products(place).length,count);assert.equal(menu.dishes.length,25);
  for(const status of ['expired','paused','pending','suspended'])assert.equal(api.products({...place,subscription:{...place.subscription,status}}).length,0);
  assert.equal(api.products({...place,subscription:{...place.subscription,endAt:'2000-01-01'}}).length,0);
 }
 assert.equal(api.products({menu,subscription:{plan:'premium',benefits:{menu:false}}}).length,0);
});
test('downgrades retain existing products, disallow growth over cap and allow reduction',()=>{
 const api=fixture().VisitaLojaPlanOffer;assert.doesNotThrow(()=>api.validateProductTransition(20,20,10));assert.doesNotThrow(()=>api.validateProductTransition(20,15,10));assert.throws(()=>api.validateProductTransition(20,21,10));assert.throws(()=>api.validateProductTransition(0,1,0));
});
test('owner gallery and analytics consume the same normalized offer',()=>{
 const window=fixture();vm.runInNewContext(fs.readFileSync(new URL('js/subscription-plan-config.js',root),'utf8'),{window});const api=window.VisitaLojaSubscriptionPlans;
 const plans=api.normalizePlans(['free','impulse','featured','premium'].map(id=>({id,features:{maxGalleryImages:6}})));
 for(const [i,id] of ['free','impulse','featured','premium'].entries()){
  const c=api.capabilitiesForPlace({subscription:{plan:id}}, {plans});assert.equal(c.maxGalleryImages,[3,10,15,20][i]);assert.equal(c.analyticsPeriodMonths,[0,1,3,12][i]);assert.equal(c.analyticsEnabled,i>0);
 }
});
test('modified HTML inline scripts parse and shared offer loads on every consumer',()=>{
 for(const file of ['admin.html','planes.html','sumar-negocio.html','index.html','negocio.html','merchant-profile.html','merchant-dashboard.html']){
  const html=fs.readFileSync(new URL(file,root),'utf8');assert.match(html,/src="\/js\/plan-offer.js\?v=1"/);
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/application\/ld\+json/.test(m[1]))new vm.Script(m[2],{filename:file});
 }
});
