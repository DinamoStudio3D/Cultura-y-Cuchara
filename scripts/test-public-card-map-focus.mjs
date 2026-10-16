import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('        function simulateMapClick('),html.indexOf('        function setSuggestedRoute('));
function fixture({maxZoom=18,reduced=false,mapReady=true,lat=-3.99,lng=-79.2}={}){
 const calls=[],section={classList:{add:value=>calls.push(['class',value])}},shell={scrollIntoView:value=>calls.push(['scroll',value])};
 const context={locations:[{id:'cafe',lat,lng}],document:{getElementById:id=>id==='mapa'?section:id==='mapCanvasShell'?shell:null},window:{matchMedia:()=>({matches:reduced})},selectLocation:(...args)=>calls.push(['select',...args]),completeChabaquitoMission:id=>calls.push(['mission',id]),markersMap:{cafe:{openPopup:()=>calls.push(['popup'])}},map:mapReady?{stop:()=>calls.push(['stop']),invalidateSize:options=>calls.push(['size',options]),getMaxZoom:()=>maxZoom,setView:(...args)=>calls.push(['view',...args])}:null};
 vm.runInNewContext(html.slice(html.indexOf('        function publicPlaceCoordinates('),html.indexOf('        function publicPlaceDirectionsUrl('))+source,context);return {calls,click:context.simulateMapClick};
}
test('card click selects the same business and shows a close-up map before its detail',()=>{
 const f=fixture();f.click(0);assert.deepEqual(f.calls.find(x=>x[0]==='select'),['select',0,false]);const view=f.calls.find(x=>x[0]==='view');assert.equal(view[2],18);assert.equal(view[1][0],-3.99);assert.equal(view[1][1],-79.2);assert.equal(view[3].animate,false);assert(f.calls.find(x=>x[0]==='popup'));assert(f.calls.find(x=>x[0]==='mission'));assert.equal(f.calls.at(-1)[0],'scroll');assert.equal(f.calls.at(-1)[1].block,'start');
});
test('focus honors tile zoom limits and reduced motion',()=>{
 const f=fixture({maxZoom:17,reduced:true});f.click(0);assert.equal(f.calls.find(x=>x[0]==='view')[2],17);assert.equal(f.calls.at(-1)[1].behavior,'auto');
});
test('missing business or unavailable map never crashes or navigates to an unrelated location',()=>{
 const f=fixture({mapReady:false});f.click(99);assert.equal(f.calls.length,0);f.click(0);assert(f.calls.find(x=>x[0]==='select'));assert(f.calls.find(x=>x[0]==='scroll'));assert(!f.calls.find(x=>x[0]==='view'));
 const invalid=fixture({lat:'invalid'});invalid.click(0);assert(!invalid.calls.find(x=>x[0]==='view'));
 const missing=fixture({lat:null,lng:null});missing.click(0);assert(!missing.calls.find(x=>x[0]==='view'));
});
test('centering Loja restores the large map without replacing GPS or zooming to the first business',()=>{
 const source=html.slice(html.indexOf('        function centerOnLoja()'),html.indexOf('        function toggleFavoriteCurrent'));
 const calls=[],gps={lat:-4.1,lng:-79.3};
 const context={userCoords:gps,document:{getElementById:()=>({classList:{remove:value=>calls.push(['remove',value])}})},map:{closePopup:()=>calls.push(['close']),invalidateSize:()=>calls.push(['size']),setView:(...args)=>calls.push(['view',...args])},clearSpotlightPin:()=>{},renderMapAndGrid:()=>{},selectLocation:(...args)=>calls.push(['select',...args]),showToast:()=>{}};
 vm.runInNewContext(source,context);context.centerOnLoja();assert.equal(context.userCoords,gps);assert.deepEqual(calls.find(x=>x[0]==='remove'),['remove','vl192-selected-stop']);assert.equal(calls.find(x=>x[0]==='view')[2],15);assert.equal(calls.find(x=>x[0]==='select'),undefined);assert(calls.find(x=>x[0]==='size'));
 context.map=null;assert.doesNotThrow(()=>context.centerOnLoja());
});
