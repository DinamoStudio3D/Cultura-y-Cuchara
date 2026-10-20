'use strict';
class N{
 constructor(){this.children=[];this.listeners={};this.attributes={};this.className='';this.style={};this.dataset={};this.isConnected=true;this.focused=false;}
 append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}setAttribute(k,v){this.attributes[k]=v}addEventListener(k,f){this.listeners[k]=f}focus(){this.focused=true}
}
function run(code){
 const ids={},doc={activeElement:null,createElement:()=>new N(),createTextNode:text=>({textContent:text}),getElementById:id=>ids[id],querySelector:()=>grid};
 for(const id of ['vl-gallery-dialog','vl-gallery-dialog-img','vl-gallery-dialog-caption','vl-gallery-counter','vl-gallery-prev','vl-gallery-next','vl-gallery-dialog-close','vl-gallery-stage'])ids[id]=new N();
 const dialog=ids['vl-gallery-dialog'];dialog.open=false;dialog.showModal=()=>{dialog.open=true};dialog.close=()=>{dialog.open=false;dialog.listeners.close()};
 const grid=new N();grid.querySelectorAll=()=>[];
 const root={document:doc,VisitaLojaPodcastMedia:{safeMediaUrl:v=>v.startsWith('assets/')?v:''},VisitaLojaPhotos:{authorURL:v=>v||''}};
 new Function('window',code)(root);const api=root.VisitaLojaGallery,opener=new N();
 const photos=[{id:'a',url:'assets/a.webp',title:'A',credit:'Uno'},{id:'b',url:'assets/b.webp',title:'B',credit:'Dos'}];
 api.open(photos,'b',{opener});if(ids['vl-gallery-dialog-img'].src!=='assets/b.webp'||ids['vl-gallery-counter'].textContent!=='2 / 2')throw Error('selected open');
 api.step(1);if(ids['vl-gallery-dialog-img'].src!=='assets/a.webp')throw Error('wrap next');
 api.step(-1);if(ids['vl-gallery-dialog-img'].src!=='assets/b.webp')throw Error('wrap previous');
 const credit=ids['vl-gallery-dialog-caption'].children[1].children[1];if(credit.textContent!=='Dos')throw Error('author sync');
 const stage=ids['vl-gallery-stage'];stage.listeners.pointerdown({pointerType:'touch',pointerId:1,clientX:200,clientY:50});stage.listeners.pointerup({pointerId:1,clientX:80,clientY:55});if(ids['vl-gallery-dialog-img'].src!=='assets/a.webp')throw Error('swipe');
 stage.listeners.pointerdown({pointerType:'touch',pointerId:2,clientX:200,clientY:50});stage.listeners.pointerup({pointerId:2,clientX:190,clientY:200});if(ids['vl-gallery-dialog-img'].src!=='assets/a.webp')throw Error('vertical swipe');
 api.setPhotos([{...photos[0],credit:'Actualizado'}]);if(!ids['vl-gallery-prev'].hidden||ids['vl-gallery-dialog-caption'].children[1].children[1].textContent!=='Actualizado')throw Error('live update');
 api.close();if(!opener.focused||dialog.open)throw Error('close restore');
 api.open(photos,'a');api.setPhotos([]);if(dialog.open)throw Error('removed collection');
 api.open([{id:'bad',url:'javascript:alert(1)'}],'bad');if(dialog.open)throw Error('unsafe source');
 return '10 gallery navigation checks passed';
}

if(require.main===module)console.log(run(require('node:fs').readFileSync(require('node:path').join(__dirname,'../js/gallery-viewer.js'),'utf8')));
module.exports=run;
