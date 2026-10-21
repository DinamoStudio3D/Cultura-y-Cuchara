import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const library=readFileSync(new URL('../js/photo-library-public.js',import.meta.url),'utf8');
test('managed photos do not inherit the first slide priority when cloned',()=>{
 const body=library.match(/hero\.map\(\(p,i\)=>\{([\s\S]*?)return img\}/)[1];
 const template={cloneNode(){return {loading:'eager',fetchPriority:'high',dataset:{},classList:{toggle(){}}}}};
 const create=(i)=>vm.runInNewContext('(function(){'+body+'return img})()',{heroTemplate:template,p:{url:'/photo-'+i,alt:'Loja',credit:'Autor',id:String(i)},i});
 assert.equal(create(0).fetchPriority,'high');assert.equal(create(0).loading,'eager');
 for(const i of [1,2,4]){const img=create(i);assert.equal(img.fetchPriority,'low');assert.equal(img.loading,'lazy');assert.equal(img.decoding,'async');assert.equal(img.src,'/photo-'+i)}
});
test('initial carousel prioritizes its visible photo and removes obsolete external preload',()=>{
 const layer=html.match(/<div class="vl-visible-photo-carousel" aria-hidden="true">([\s\S]*?)<\/div>/)[1];
 const images=[...layer.matchAll(/<img\s+([^>]+)>/g)].map(m=>m[1]);assert.equal(images.length,5);
 assert.match(images[0],/loading="eager" fetchpriority="high"/);
 for(const img of images.slice(1))assert.match(img,/loading="lazy" fetchpriority="low"/);
 assert.doesNotMatch(html,/<link[^>]+rel="preload"[^>]+href="https:\/\/i.imgur.com\/0QSbhqQ/);
 assert.match(html,/<link[^>]+rel="preload"[^>]+href="assets\/photos\/centro-loja-torre-reloj.webp"/);
});
