import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url),model=require('../js/video-gallery-model.js');
test('video sources accept known YouTube formats and HTTPS media, reject executable and impersonated URLs',()=>{
 for(const url of ['https://youtu.be/n0BJGAkU9cg','https://www.youtube.com/watch?v=n0BJGAkU9cg','https://youtube.com/shorts/n0BJGAkU9cg','https://youtube-nocookie.com/embed/n0BJGAkU9cg']){const s=model.source(url);assert.equal(s.type,'youtube');assert.match(s.embed,/youtube-nocookie.com\/embed\/n0BJGAkU9cg\?playsinline=1/);}
 assert.equal(model.source('https://cdn.example.com/movie.mp4?version=1').type,'file');
 for(const url of ['javascript:alert(1)','http://example.com/a.mp4','https://youtube.com.evil.test/watch?v=n0BJGAkU9cg','https://user:pass@example.com/a.mp4','https://youtu.be/invalid','https://youtube.com/movie.mp4'])assert.equal(model.source(url),null,url);
});
test('public data is bounded, publication is explicit and invalid entries fail validation',()=>{
 const d=model.normalize({active:'yes',items:[{title:'Draft',url:'https://example.com/a.mp4'},{title:'Visible',url:'https://example.com/b.webm',published:true}]});assert.equal(d.active,false);assert.equal(d.items[0].published,false);assert.equal(d.items[1].published,true);assert.equal(model.validate(d),'');assert(model.validate({items:[{title:'Bad',url:'javascript:evil()'}]}));assert(model.validate({items:[{title:'',url:'https://example.com/a.mp4'}]}));assert.equal(model.image('javascript:evil()'),'');assert.equal(model.normalize({items:Array.from({length:40},()=>({title:'a'}))}).items.length,30);
});
test('admin save is isolated and public players are click-loaded with an inline mobile option',()=>{
 const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');const admin=read('js/admin-video-gallery.js'),publicJS=read('js/video-gallery.js');assert.match(admin,/doc\('videoGallery'\)/);assert.match(admin,/runTransaction/);assert.match(admin,/code:'conflict'/);assert.match(publicJS,/button.onclick=play/);assert.match(publicJS,/player.playsInline=true/);assert.match(publicJS,/player.allowFullscreen=true/);assert.match(publicJS,/media.pause\(\)/);assert.match(publicJS,/releaseFocus\?\.\(\)/);assert.match(read('firestore.rules'),/match \/settings\/\{documentId\}[\s\S]*?allow create, update, delete: if isViveLojaAdmin\(\)/);
});

test('homepage gallery reads published videos using the named public Firebase app',async()=>{
 const vm=await import('node:vm'),model=require('../js/video-gallery-model.js');
 class Element{constructor(){this.children=[];this.hidden=false;}append(...nodes){this.children.push(...nodes);}setAttribute(){}replaceChildren(...nodes){this.children=nodes;}querySelector(){return null;}}
 const host=new Element(),calls=[],document={getElementById:id=>id==='loja-en-video'?host:null,createElement:()=>new Element(),addEventListener(){}};
 const firestore={collection(name){calls.push(name);return{doc(id){calls.push(id);return{onSnapshot(next){next({exists:true,data:()=>({active:true,items:[{title:'Jipiro',url:'https://youtu.be/n0BJGAkU9cg',published:true}]})});}};}};}};
 const context={window:{VisitaLojaVideos:model},document,firebase:{app(name){assert.equal(name,'viveLojaPublic');return{firestore:()=>firestore};},firestore(){throw Error('No default Firebase app');}}};
 vm.runInNewContext(fs.readFileSync(new URL('../js/video-gallery.js',import.meta.url),'utf8'),context);assert.deepEqual(calls,['settings','videoGallery']);assert.equal(host.hidden,false);assert.equal(host.children[1].children.length,1);
});
