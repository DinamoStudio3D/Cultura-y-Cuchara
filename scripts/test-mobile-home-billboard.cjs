'use strict';
class Node{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.listeners={};this.className='';this.style={setProperty:()=>{}};this.classList={add:c=>{this.className+=' '+c},remove:c=>{this.className=this.className.split(' ').filter(x=>x!==c).join(' ')}};}
 append(...n){this.children.push(...n)}replaceChildren(...n){this.children=n}setAttribute(k,v){this.attributes[k]=String(v)}removeAttribute(k){delete this.attributes[k]}addEventListener(k,fn){this.listeners[k]=fn}contains(){return false}remove(){}
}
function walk(n,cls){return [n,...n.children.flatMap(c=>walk(c,cls))].filter(x=>x.className===cls);}
function run(code){
 const doc={activeElement:null,hidden:false,createElement:t=>new Node(t,doc)},host=new Node('section',doc);let tick,opened;
 const root={document:doc,matchMedia:()=>({matches:false}),clearInterval:()=>{},setInterval:fn=>{tick=fn;return 1},VisitaLojaEventsSpotlight:{upcoming:x=>x,safeImage:x=>x||''}};
 new Function('window',code)(root);const render=x=>root.VisitaLojaEventsBillboard.render(x,{host,open:e=>opened=e.id});
 render([]);if(host.hidden||walk(host,'vb-empty-link')[0]?.href!=='#agenda')throw Error('empty agenda');
 render([{id:'a',title:'A',img:'poster.svg'},{id:'b',title:'B',img:'poster2.svg'}]);
 if(host.className.includes('vb-is-empty'))throw Error('empty class cleanup');
 if(walk(host,'vb-mobile-caption').length!==2)throw Error('poster readability');
 tick();const cards=walk(host,'vb-art');if(cards[1].attributes['aria-current']!=='true'||cards[0].tabIndex!==-1)throw Error('rotation and focus');
 cards[1].listeners.click();if(opened!=='b')throw Error('selected event');
 render([{id:'c',title:'C',bannerImg:'banner.svg'}]);if(walk(host,'vb-mobile-caption').length)throw Error('banner duplication');
 return '6 mobile billboard behavior checks passed';
}

if(require.main===module)console.log(run(require('node:fs').readFileSync(require('node:path').join(__dirname,'../js/events-billboard.js'),'utf8')));
module.exports=run;
