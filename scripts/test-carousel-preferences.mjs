import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/<script id="vl-visible-photo-carousel-script">([\s\S]*?)<\/script>/)[1];
function fixture({saving=false,reduced=false}={}){
 const timers=new Map(),mediaListeners=[],classObservers=[];let next=0;
 const image={alt:'Loja por Autor',classList:{toggle(){}},getAttribute:()=>'/photo.webp',dataset:{}};
 const layer={querySelectorAll:()=>[image],style:{setProperty(){}}};
 const root={querySelector:s=>s==='.vl-visible-photo-carousel'?layer:null};
 const document={readyState:'complete',hidden:false,documentElement:{classList:{contains:()=>saving}},querySelector:()=>root,querySelectorAll:()=>[image]};
 const media={get matches(){return reduced},addEventListener:(event,fn)=>mediaListeners.push(fn)};
 vm.runInNewContext(source,{document,window:{addEventListener(){}},location:{search:''},URLSearchParams,matchMedia:()=>media,MutationObserver:class{constructor(fn){classObservers.push(fn)}observe(){}},setInterval(fn,delay){timers.set(++next,{fn,delay});return next},clearInterval(id){timers.delete(id)}});
 return {timers,setSaving(value){saving=value;classObservers[0]()},setReduced(value){reduced=value;mediaListeners[0]()}};
}
const rotations=f=>[...f.timers.values()].filter(t=>t.delay===6000);
test('automatic rotation starts only without data saver or reduced motion',()=>{
 assert.equal(rotations(fixture()).length,1);
 assert.equal(rotations(fixture({saving:true})).length,0);
 assert.equal(rotations(fixture({reduced:true})).length,0);
});
test('preference changes stop and resume one rotation timer without reload',()=>{
 const f=fixture();f.setSaving(true);assert.equal(rotations(f).length,0);
 f.setSaving(false);assert.equal(rotations(f).length,1);
 f.setReduced(true);assert.equal(rotations(f).length,0);
 f.setSaving(true);f.setReduced(false);assert.equal(rotations(f).length,0);
 f.setSaving(false);f.setSaving(false);assert.equal(rotations(f).length,1);
});
