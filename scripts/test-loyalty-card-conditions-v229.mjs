import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/fidelidad-v2-ui.js',import.meta.url),'utf8');const window={addEventListener(){}};vm.runInNewContext(source,{window});const card=window.VisitaLojaLoyaltyV2.card;
test('customer cards reflect saved program conditions without duplicating descriptions',()=>{const html=card({placeId:'cafe',placeName:'Café',total:3,target:10,reward:'Una bebida',rewardDescription:'Solo de lunes a viernes.',program:{maxVisitsPerDay:1,rewardValidityDays:30}});assert.match(html,/Máximo 1 visita confirmada por día/);assert.match(html,/30 días para retirar/);assert.equal((html.match(/Solo de lunes a viernes\./g)||[]).length,1);assert.match(html,/<details class="loyalty-pass__rules">/);assert.match(html,/aria-valuenow="3"/);assert.match(html,/aria-valuemax="10"/);});
test('invalid rules are omitted and business descriptions are escaped',()=>{const html=card({rewardDescription:'<img src=x onerror=bad>',program:{maxVisitsPerDay:0,rewardValidityDays:999}});assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x|Máximo|999 días/);assert.doesNotMatch(card({}),/Condiciones del beneficio/);});
test('complete and long cards retain target stamps, distinct business identity and actions',()=>{const html=card({placeId:'other',placeName:'Un nombre de negocio muy largo',target:30,total:30});assert.equal((html.match(/aria-label="Sello obtenido"/g)||[]).length,30);assert.match(html,/loyalty-pass--many/);assert.match(html,/data-place-id="other"/);assert.match(html,/aria-valuenow="30"/);assert.match(html,/fidelidad.html\?place=other/);assert.match(html,/0 visitas pendientes|Tarjeta terminada/);});
test('administrative preview keeps the conditions open across clicks and form edits',()=>{
 const ids={programPlace:{value:'cafe'},programTarget:{value:'10'},programDaily:{value:'1'},programValidity:{value:'30'},programReward:{value:'Café'},programDescription:{value:'Solo por la mañana.'}};
 const form=new EventTarget(),doc=new EventTarget();
 let currentRules, renders=0;
 const summary=()=>({focus(){doc.activeElement=this}});
 const host={
  set innerHTML(markup){renders++;this.markup=markup;const control=summary();currentRules={open:false,querySelector:()=>control}},
  querySelector:()=>currentRules
 };
 Object.assign(doc,{getElementById:id=>id==='programForm'?form:id==='loyaltyProgramCardPreview'?host:ids[id]});
 const previewWindow={VisitaLojaLoyaltyV2:{card}};
 const preview=fs.readFileSync(new URL('../js/loyalty-program-preview.js',import.meta.url),'utf8');
 vm.runInNewContext(preview,{window:previewWindow,document:doc,places:[{id:'cafe',title:'Café'}],setTimeout:fn=>fn()});
 currentRules.open=true;
 doc.dispatchEvent(new Event('click'));
 previewWindow.refreshLoyaltyProgramPreview();
 assert.equal(renders,1);
 assert.equal(currentRules.open,true);
 currentRules.querySelector().focus();
 ids.programDaily.value='2';
 ids.programValidity.value='45';
 form.dispatchEvent(new Event('input'));
 assert.equal(renders,2);
 assert.equal(currentRules.open,true);
 assert.equal(doc.activeElement,currentRules.querySelector());
 assert.match(host.markup,/Máximo 2 visitas confirmadas por día/);
 assert.match(host.markup,/45 días para retirar/);
 ids.programPlace.value='otra';
 form.dispatchEvent(new Event('change'));
 assert.equal(currentRules.open,false);
});
