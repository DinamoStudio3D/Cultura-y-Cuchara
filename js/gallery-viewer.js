(function(root){'use strict';
const doc=root.document,dialog=doc.getElementById('vl-gallery-dialog'),grid=doc.querySelector('.vl-photo-gallery-grid');if(!dialog||!grid)return;
const image=doc.getElementById('vl-gallery-dialog-img'),caption=doc.getElementById('vl-gallery-dialog-caption'),counter=doc.getElementById('vl-gallery-counter'),prev=doc.getElementById('vl-gallery-prev'),next=doc.getElementById('vl-gallery-next'),closeButton=doc.getElementById('vl-gallery-dialog-close'),stage=doc.getElementById('vl-gallery-stage');
let photos=[],index=0,opener=null,start=null,pointers=new Set();
const safe=value=>{const v=typeof value==='string'?value.trim():'';if(root.VisitaLojaPodcastMedia)return root.VisitaLojaPodcastMedia.safeMediaUrl(v);return /^\/?assets\/[a-zA-Z0-9_./%-]+$/.test(v)?v:'';};
function authorURL(value){return root.VisitaLojaPhotos?.authorURL(value)||'';}
function render(){const p=photos[index];if(!p)return;image.src=p.url;image.alt=p.alt||p.title;image.draggable=false;caption.replaceChildren();
 const title=doc.createElement('strong');title.textContent=p.title;caption.append(title);
 const credit=doc.createElement('span');credit.append(doc.createTextNode('Fotografía: '));const href=authorURL(p.creditUrl),name=doc.createElement(href?'a':'span');name.textContent=p.credit||'Autor no indicado';if(href){name.href=href;name.target='_blank';name.rel='noopener noreferrer'}credit.append(name);caption.append(credit);
 counter.textContent=(index+1)+' / '+photos.length;prev.hidden=next.hidden=photos.length<2;prev.disabled=next.disabled=photos.length<2;
}
function setPhotos(items){const selected=photos[index]?.id;photos=(Array.isArray(items)?items:[]).map((p,i)=>({...p,id:String(p.id||p.url||i),url:safe(p.url),title:p.title||p.alt||'Loja en imágenes'})).filter(p=>p.url);const same=photos.findIndex(p=>p.id===selected);index=same>=0?same:Math.max(0,Math.min(index,photos.length-1));if(dialog.open){if(photos.length)render();else close();}}
function open(items,id,options={}){setPhotos(items);if(!photos.length)return;const found=photos.findIndex(p=>p.id===String(id));index=found>=0?found:0;opener=options.opener||doc.activeElement;render();if(!dialog.open)dialog.showModal();closeButton.focus();}
function step(delta){if(!dialog.open||photos.length<2)return;index=(index+delta+photos.length)%photos.length;render();}
function close(){if(dialog.open)dialog.close();}
prev.addEventListener('click',()=>step(-1));next.addEventListener('click',()=>step(1));closeButton.addEventListener('click',close);
dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
dialog.addEventListener('close',()=>{start=null;pointers.clear();if(opener?.isConnected&&typeof opener.focus==='function')opener.focus();opener=null;});
dialog.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowRight'?1:-1);}});
stage.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;pointers.add(e.pointerId);start=pointers.size===1?{x:e.clientX,y:e.clientY,id:e.pointerId}:null;});
stage.addEventListener('pointerup',e=>{const origin=start;pointers.delete(e.pointerId);start=null;if(!origin||origin.id!==e.pointerId||pointers.size)return;const dx=e.clientX-origin.x,dy=e.clientY-origin.y;if(Math.abs(dx)>=50&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);});
stage.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);start=null;});
const fallback=()=>[...grid.querySelectorAll('.vl-photo-gallery-item')].map((card,i)=>{const img=card.querySelector('img');return{id:card.dataset.photoId||'static-'+i,url:img?.getAttribute('src')||'',alt:img?.alt||'',title:card.querySelector('figcaption span')?.textContent||img?.alt||'Loja',credit:'Geovanny Muñoz',creditUrl:'https://www.instagram.com/geo_munoz/'};});
function fromCard(card){const cards=[...grid.querySelectorAll('.vl-photo-gallery-item')];open(fallback(),card.dataset.photoId||'static-'+cards.indexOf(card),{opener:card});}
grid.querySelectorAll('.vl-photo-gallery-item').forEach(card=>{card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','Abrir fotografía: '+(card.querySelector('figcaption span')?.textContent||'Loja'));});
grid.addEventListener('click',e=>{const card=e.target.closest('.vl-photo-gallery-item');if(!card||card.classList.contains('vl-managed-gallery-card')||e.target.closest('a'))return;fromCard(card);});
grid.addEventListener('keydown',e=>{const card=e.target.closest('.vl-photo-gallery-item');if(!card||e.target!==card||card.classList.contains('vl-managed-gallery-card'))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();fromCard(card);}});
root.VisitaLojaGallery={open,step,close,setPhotos};
})(window);