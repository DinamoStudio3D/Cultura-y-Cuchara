import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('        let mascotMessageTimer;'),html.indexOf('        function toggleMascotBubble()'));
function fixture(mobile){const timers=new Map(),classes=new Set();let next=0;const bubble={hidden:true,classList:{toggle(c,on){on?classes.add(c):classes.delete(c)},add(c){classes.add(c)}}};const ctx={document:{getElementById:()=>bubble},window:{matchMedia:()=>({matches:mobile})},setTimeout(fn,delay){timers.set(++next,{fn,delay});return next},clearTimeout(id){timers.delete(id)}};vm.runInNewContext(source,ctx);return{ctx,bubble,timers,classes}}
test('mobile section hints remain hidden while preserving their message',()=>{const f=fixture(true);f.ctx.setMascotMessage('Busca una parada');assert.equal(f.bubble.hidden,true);assert.equal(f.bubble.textContent,'Busca una parada');assert.equal(f.timers.size,0);assert(f.classes.has('is-quiet'));assert.match(html,/aria-label="Hablar con Chabaquito"/)});
test('desktop hints disappear and newer messages replace the previous timer',()=>{const f=fixture(false);f.ctx.setMascotMessage('Primero');assert.equal(f.bubble.hidden,false);f.ctx.setMascotMessage('Segundo');assert.equal(f.timers.size,1);const timer=[...f.timers.values()][0];assert.equal(timer.delay,6000);timer.fn();assert.equal(f.bubble.hidden,true);assert.equal(f.bubble.textContent,'Segundo')});
