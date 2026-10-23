import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {createRequire} from 'node:module';const require=createRequire(import.meta.url),model=require('../js/place-discovery.js');
const places=[{id:'c',title:'Café Jipiro',category:'cafe',openHour:8,closeHour:20},{id:'h',title:'Hotel',category:'hotel',cantonId:'saraguro'}];
test('saved places compose with existing text, canton, category and hours filters',()=>{
 const savedIds=['c','unavailable'],before=[...savedIds];assert(model.matches(places[0],{savedOnly:true,savedIds}));assert(!model.matches(places[1],{savedOnly:true,savedIds}));
 assert(model.matches(places[0],{savedOnly:true,savedIds,query:'Jipiro',category:'cafe',cantonId:'loja',openOnly:true},()=>true));
 for(const extra of [{query:'hotel'},{category:'hotel'},{cantonId:'saraguro'},{openOnly:true}])assert(!model.matches(places[0],{savedOnly:true,savedIds,...extra},()=>false));
 assert.deepEqual(savedIds,before);assert(model.matches(places[1],{}));
});
function harness(){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,hidden:false,textContent:'',classList:{toggle(){}}});return nodes.get(id);};
 const cards=places.map(p=>({dataset:{locationId:p.id},style:{},classList:{toggle(name,hidden){this.hidden=hidden;}}}));
 const context={window:{VisitaLojaDiscovery:model,matchMedia:()=>({matches:true})},document:{getElementById:node,querySelector:()=>null,querySelectorAll:()=>cards},locations:places,favoriteLocations:['c','unavailable'],placeDiscoveryCategory:'all',isLocOpenNow:()=>true,currentLang:'es',userCoords:null,updateClearFiltersButton(value){context.clearVisible=value;}};
 node('establecimientos').scrollIntoView=()=>{context.scrolled=true;};
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 vm.runInNewContext(html.slice(html.indexOf('function searchItems()'),html.indexOf('function filterItems(')),context);
 context.filterItems=cat=>{context.placeDiscoveryCategory=cat;context.searchItems();};
 vm.runInNewContext(html.slice(html.indexOf('function openSavedPlaces()'),html.indexOf('function searchFromWelcome(')),context);
 return{context,node,cards};
}
test('favorites access resets competing filters without altering any saved IDs',()=>{
 const{context:c,node,cards}=harness();node('searchInput').value='missing';node('placeCantonFilter').value='saraguro';node('placeOpenFilter').checked=true;c.placeDiscoveryCategory='hotel';
 c.openSavedPlaces();assert.equal(node('placeSavedFilter').checked,true);assert.equal(cards[0].classList.hidden,false);assert.equal(cards[1].classList.hidden,true);assert.equal(node('savedPlacesCount').textContent,'2');assert.equal(c.scrolled,true);assert.deepEqual(c.favoriteLocations,['c','unavailable']);
 c.clearAllPlaceFilters();assert.equal(node('placeSavedFilter').checked,false);assert.equal(cards[1].classList.hidden,false);assert.deepEqual(c.favoriteLocations,['c','unavailable']);
});
test('removing the last favorite while filtered produces guidance and hides route access',()=>{
 const{context:c,node,cards}=harness();c.openSavedPlaces();c.favoriteLocations=[];c.searchItems();assert(cards.every(card=>card.classList.hidden));assert.equal(node('savedPlacesRoute').hidden,true);assert.match(node('placeEmptyTitle').textContent,/Todavía no tienes/);assert.match(node('placeEmptyHelp').textContent,/hoja/);assert.equal(c.clearVisible,true);
});
