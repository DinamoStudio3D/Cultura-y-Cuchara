import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fixture(){
 let listener;const calls=[],nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},textContent:'',hidden:false,classList:{add(){},remove(){},contains(){return true}},removeAttribute(key){delete this[key]},setAttribute(key,value){this[key]=value}});return nodes.get(id)};
 const ctx={locations:[],currentLocationId:null,currentLocationIndex:-1,currentLang:'es',currentRestaurantMenu:{},document:{getElementById:node,querySelectorAll:()=>[]},window:{VisitaLojaPlacePreviewMedia:{render:(...a)=>calls.push(['media',...a])}},map:{closePopup(){}},stopAudioGuide:()=>{},closeModal:()=>{},renderEverything:()=>calls.push(['render']),selectLocation:(...a)=>calls.push(['select',...a]),categories:[],scheduleSubscriptionRefresh:()=>{},checkLiveEventsBanner:()=>{},checkUrlParamForCheckin:()=>{},setLocationsSyncStatus:()=>{},isPublicContent:x=>!x.publicationStatus||x.publicationStatus==='published',db:{collection:()=>({onSnapshot:(options,fn)=>listener=fn})}};
 const start=html.indexOf('            db.collection("locales").onSnapshot('),end=html.indexOf("            window.addEventListener('offline'",start);
 vm.createContext(ctx);vm.runInContext(html.slice(start,end)+html.slice(html.indexOf('        function clearCurrentLocation()'),html.indexOf('        function selectLocation(')),ctx);
 return{ctx,node,calls,snapshot:(rows,fromCache=false)=>listener({metadata:{fromCache},forEach:fn=>rows.forEach(({id,...data})=>fn({id,data:()=>data}))})};
}
test('cached listings never render; authoritative empty snapshot clears businesses, category data and selected actions',()=>{
 const f=fixture();f.snapshot([{id:'old',title:'Old'}],true);assert.equal(f.ctx.locations.length,0);
 f.snapshot([{id:'real',title:'Hotel Carrión'},{id:'draft',title:'Hidden',publicationStatus:'draft'},{id:'motel',title:'Motel'}]);assert.equal(f.ctx.locations.length,1);
 f.ctx.currentLocationId='real';f.ctx.currentLocationIndex=0;f.snapshot([]);assert.equal(f.ctx.locations.length,0);assert.equal(f.ctx.currentLocationId,null);assert.equal(f.ctx.currentLocationIndex,-1);assert.equal(f.node('mapPreviewCard').dataset.empty,'true');assert.equal(f.node('previewWhatsapp').href,undefined);assert.equal(f.node('previewReadMore').hidden,true);assert.equal(f.ctx.currentRestaurantMenu,null);assert(f.calls.some(c=>c[0]==='media'));
});
test('reordering or updating selected records refreshes the same business without tracking a second visit',()=>{
 const f=fixture();f.ctx.currentLocationId='expreso';f.snapshot([{id:'hotel',title:'Hotel'},{id:'expreso',title:'Expreso al Sur Cafetería'}]);assert.deepEqual(f.calls.find(c=>c[0]==='select'),['select',1,false,false]);
});
test('unpublishing the selected business clears it and never substitutes another',()=>{
 const f=fixture();f.ctx.currentLocationId='expreso';f.snapshot([{id:'hotel',title:'Hotel'},{id:'expreso',publicationStatus:'draft'}]);assert.equal(f.ctx.currentLocationId,null);assert.equal(f.ctx.locations.length,1);assert(!f.calls.some(c=>c[0]==='select'));
});
test('getCurrentLocation requires the selected ID even when its former index still exists',()=>{
 const ctx={locations:[{id:'other'}],currentLocationId:'deleted',currentLocationIndex:0};vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('        function getCurrentLocation()'),html.indexOf('        let visitedLocations')),ctx);assert.equal(ctx.getCurrentLocation(),null);ctx.currentLocationId='other';assert.equal(ctx.getCurrentLocation().id,'other');ctx.currentLocationId=null;assert.equal(ctx.getCurrentLocation(),null);
});
test('direct business route rejects drafts and deleted records and never caches published SEO',async()=>{
 const original=globalThis.fetch;try{for(const status of ['draft','published',null]){globalThis.fetch=async()=>({ok:true,json:async()=>({documents:status===null?[]:[{name:'p/locales/cafe',fields:{title:{stringValue:'Café'},publicationStatus:{stringValue:status}}}]})});let code,cache;await require('../api/parada.js')({query:{slug:'cafe'}},{setHeader(k,v){if(k==='Cache-Control')cache=v},status(c){code=c;return{send(){}}}});assert.equal(code,status==='published'?200:404);if(code===200)assert.equal(cache,'no-store')}}finally{globalThis.fetch=original}
});
