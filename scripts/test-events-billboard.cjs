const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=require('../js/events-spotlight.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/events-billboard.js'),'utf8');
class MiniNode{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.listeners={};this.className='';this.hidden=false;this._text='';this.classList={add:(v)=>{this.className+=' '+v;},remove:(v)=>{this.className=this.className.split(' ').filter(x=>x!==v).join(' ');}};}
 set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];this._text='';}
 setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,fn){this.listeners[k]=fn;}
 contains(el){return this===el||this.children.some(c=>c.contains(el));}
}
function walk(node,p){return [node,...node.children.flatMap(c=>walk(c,p))].filter(p);}
function setup(reduced=false){
 const doc={hidden:false,activeElement:null,readyState:'loading',addEventListener(){},createElement(tag){return new MiniNode(tag,this);}};
 const host=new MiniNode('section',doc);doc.getElementById=()=>host;const timers=new Map();let key=0;
 const root={document:doc,VisitaLojaEventsSpotlight:api,matchMedia:()=>({matches:reduced}),setInterval:fn=>{timers.set(++key,fn);return key;},clearInterval:id=>timers.delete(id)};
 new Function('window',source)(root);
 return {doc,host,timers,render:(events,options={})=>root.VisitaLojaEventsBillboard.render(events,{host,now:Date.parse('2026-10-20T12:00:00Z'),...options})};
}
const events=[{id:'one',title:'Evento uno',date:'2026-10-21',time:'18:00',bannerImg:'assets/events-preview/music-banner.svg',img:'assets/events-preview/music.svg'},{id:'two',title:'Evento dos',date:'2026-10-22',time:'18:00'}];
const cls=(host,name)=>walk(host,e=>e.className.split(' ').includes(name))[0];
test('banner rotates automatically and details use the selected event',()=>{
 const f=setup();let selected;f.render(events,{open:e=>selected=e.id});
 assert.equal(walk(f.host,e=>e.tagName==='img')[0].src,events[0].bannerImg);
 [...f.timers.values()][0]();assert(f.host.textContent.includes('Evento dos'));cls(f.host,'vb-detail').listeners.click();assert.equal(selected,'two');
});
test('rotation pauses while hidden, focused, or manually navigated',()=>{
 const f=setup();f.render(events);const tick=()=>[...f.timers.values()][0]();
 f.doc.hidden=true;tick();assert(f.host.textContent.includes('Evento uno'));
 f.doc.hidden=false;f.doc.activeElement=cls(f.host,'vb-detail');tick();assert(f.host.textContent.includes('Evento uno'));
 f.doc.activeElement=null;cls(f.host,'vb-arrow').listeners.click();assert(f.host.textContent.includes('Evento dos'));tick();assert(f.host.textContent.includes('Evento dos'));
});
test('rerenders clean old timers and empty event lists remove the carousel',()=>{
 const f=setup();f.render(events);f.render(events);assert.equal(f.timers.size,1);f.render([]);assert.equal(f.timers.size,0);assert.equal(f.host.hidden,true);
});
test('reduced motion starts paused with an explicit play control',()=>{
 const f=setup(true);f.render(events);[...f.timers.values()][0]();assert(f.host.textContent.includes('Evento uno'));assert.equal(cls(f.host,'vb-pause').textContent,'Reproducir');
});
test('embedded detail shares the agenda heading and uses light site surfaces',()=>{
 const f=setup(),host=new MiniNode('section',f.doc);api.render(events,{host,embedded:true,now:Date.parse('2026-10-20T12:00:00Z')});
 assert.equal(cls(host,'ve-heading'),undefined);assert.equal(cls(host,'ve-feature').attributes['data-vl-surface'],'light');
});
