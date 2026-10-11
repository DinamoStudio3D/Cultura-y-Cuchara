import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(readFileSync(new URL('../js/admin-mission-presentation.js',import.meta.url),'utf8'),context);
const cards=context.window.VisitaLojaAdminMissionPresentation.cards;
test('both mission loaders use the same truthful status, goal and badge presentation',()=>{
 for(const attr of ['data-edit','data-static-mission-edit']){const html=cards([{id:'one',title:'Explorar',status:'active',type:'canton_visits',targetCount:3,badge:{title:'Viajero'}}],attr);assert.match(html,/Activa/);assert.match(html,/Meta: 3/);assert.match(html,/Insignia: Viajero/);assert(html.includes(attr+'="one"'));assert.match(html,/Cantones/);}
});
test('configured mission text and identifiers cannot inject markup or attributes',()=>{
 const html=cards([{id:'" onclick="bad',title:'<script>bad</script>',description:'<img onerror="bad">',status:'" onclick="bad',targetCount:'invalid',badge:{icon:'<svg>',title:'<b>fake</b>'}}],'onclick');assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(!html.includes('<svg>'));assert(!html.includes(' onclick="bad'));assert.match(html,/data-state="draft"/);assert.match(html,/Meta: 1/);assert.match(html,/data-edit=/);
 assert.match(cards([]),/Todavía no hay misiones/);
});
