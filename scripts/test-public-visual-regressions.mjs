import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html'),layout=read('css/public-layout.css');
function menuFixture(){
 const elements=new Map();
 const document={getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:''});return elements.get(id)}};
 const context={document,window:{},URL,currentLang:'es',paidPlaceBenefits:()=>({menu:true}),escapeHTML:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
 vm.createContext(context);vm.runInContext(read('js/podcast-media.js').replace(/if\(typeof document!=='undefined'\)/,"if(false)"),context);
 vm.runInContext(html.slice(html.indexOf('        let currentRestaurantMenu=null;'),html.indexOf('        function selectRestaurantMenuCategory')),context);
 return {context,elements,run:code=>vm.runInContext(code,context)};
}
test('configured restaurant dishes take precedence over the demo without replacing their photos',()=>{
 const f=menuFixture();f.context.place={title:'Mamá Lola',menu:{active:true,dishes:[{name:'Plato propio',price:'$7',image:'https://example.com/own.jpg'}]}};
 const menu=f.run('restaurantMenuFor(place)');assert.equal(menu.demo,false);assert.equal(menu.dishes[0].image,f.context.place.menu.dishes[0].image);
});
test('the six sample menu photos remain configured and distinct',()=>{
 const f=menuFixture(),dishes=f.run('mamaLolaDemoDishes()');assert.equal(dishes.length,6);assert.equal(new Set(dishes.map(x=>x.image)).size,6);
 for(const dish of dishes){assert.match(dish.image,/^https:\/\//);assert.doesNotMatch(dish.image,/photo-unavailable/)}
});
test('restaurant rendering retains categories, prices, English labels and safe photo recovery',()=>{
 const f=menuFixture();f.run("currentRestaurantMenu={title:'Carta',dishes:[{name:'Especial',nameEn:'Special',price:'$7.50',category:'Principal',categoryEn:'Main',image:'https://example.com/own.jpg',recommended:true},{name:'Postre',price:'$2',category:'Postres',image:'javascript:alert(1)'}]};renderRestaurantMenu()");
 let grid=f.elements.get('restaurantMenuGrid').innerHTML;assert.match(grid,/https:\/\/example.com\/own.jpg/);assert.match(grid,/\$7\.50/);assert.match(grid,/Recomendado/);assert.doesNotMatch(grid,/javascript:/);assert.match(grid,/onerror="this.onerror=null;/);
 f.run("renderRestaurantMenu('Principal')");assert.doesNotMatch(f.elements.get('restaurantMenuGrid').innerHTML,/Postre/);
 f.run("currentLang='en';renderRestaurantMenu('Main')");grid=f.elements.get('restaurantMenuGrid').innerHTML;assert.match(grid,/Special/);assert.match(grid,/Recommended/);assert.doesNotMatch(grid,/Postre/);
});
test('map controls have a local stacking context and dialogs cover navigation',()=>{
 const navigation=Number(layout.match(/nav\.glass-nav\.sticky\{z-index:(\d+)!important/)[1]);
 const modal=Number(layout.match(/body>div\[id\$="Modal"\]\.fixed\s*\{\s*z-index:(\d+)/)[1]);assert(modal>navigation);
 assert.match(layout,/#mapa #mapCanvasShell\s*\{[^}]*isolation:isolate;[^}]*z-index:0/);
 assert.match(layout,/body>#accountModal,body>#qrClaimModal\s*\{\s*z-index:2100/);
});
test('dialog and frame labels wrap while menu scrolling remains inside the viewport',()=>{
 assert.match(layout,/body>div\[id\$="Modal"\] \.truncate,[\s\S]*?#postcardFramesContainer \.truncate\s*\{[^}]*white-space:normal !important;[^}]*overflow:visible !important/);
 assert.match(layout,/#restaurantMenuGrid\s*\{[^}]*min-height:0/);
 assert.match(layout,/#restaurantMenuModal>div\s*\{\s*height:calc\(100dvh - 32px\)/);
 assert.match(layout,/#restaurantMenuModal header>button[^}]*flex-shrink:0/);
});
test('map action foreground/background pairs meet normal-text contrast, including hover and favorite states',()=>{
 const source=read('css/place-experience-v101.css').split('/* V189:')[1]+read('css/public-colors.css').split('/* V191:')[1];
 const lum=hex=>{hex=hex.slice(1);if(hex.length===3)hex=[...hex].map(x=>x+x).join('');return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)};
 let checked=0;for(const match of source.matchAll(/\{([^{}]+)\}/g)){const fg=match[1].match(/--vl-text:(#[\da-f]+);/i),bg=match[1].match(/background:(#[\da-f]+) !important/i);if(!fg||!bg)continue;const a=lum(fg[1]),b=lum(bg[1]);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,match[1]);checked++}assert(checked>=10);
 assert.doesNotMatch(layout,/#previewStampButton\{background:#fff7ed!important/);
});
