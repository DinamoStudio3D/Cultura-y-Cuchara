import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope = {};
vm.runInNewContext(fs.readFileSync(new URL('../js/vendor/lame-1.2.1.min.js', import.meta.url),'utf8'), scope);
let duration = 2;
const rate=24000;
const samples=new Float32Array(rate*2);
for(let i=0;i<samples.length;i++)samples[i]=Math.sin(i*2*Math.PI*440/rate)*.3;
globalThis.window={lamejs:scope.lamejs,AudioContext:class{async decodeAudioData(){return {duration}} async close(){}},OfflineAudioContext:class{createBufferSource(){return {connect(){},start(){}}} async startRendering(){return {getChannelData:()=>samples}}}};
const {compressAudio}=await import('../js/admin-audio-compression.js');
test('Produces a smaller MP3 from decoded voice and reports actual size',async()=>{
 const input=new File([new Uint8Array(192000)],'narracion.wav',{type:'audio/wav'});
 const result=await compressAudio(input,new AbortController().signal);
 assert.equal(result.file.type,'audio/mpeg');assert.equal(result.file.name,'narracion.mp3');assert.ok(result.file.size<20000);assert.ok(result.file.size>1000);assert.match(result.summary,/% menos/);
 fs.writeFileSync('/tmp/visitaloja-compressed-test.mp3',new Uint8Array(await result.file.arrayBuffer()));
});
test('Keeps an already smaller MP3 without increasing transfer',async()=>{
 const input=new File([new Uint8Array(1000)],'voz.mp3',{type:'audio/mpeg'});
 assert.equal((await compressAudio(input)).file,input);
});
test('Rejects cancellation and excessive duration before upload',async()=>{
 const input=new File(['test'],'voz.wav');const c=new AbortController();c.abort();
 await assert.rejects(()=>compressAudio(input,c.signal),{name:'AbortError'});
 duration=301;await assert.rejects(()=>compressAudio(input),/5 minutos/);duration=2;
});
