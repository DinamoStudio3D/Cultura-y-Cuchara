/* Biblioteca fotográfica pública: datos administrados en settings/main. */
(()=>{'use strict';
const sections=['Portada principal','Loja, en cada mirada','Loja en imágenes'];
const valid=value=>{try{const u=new URL(value,location.href);return (u.origin===location.origin&&u.pathname.startsWith('/assets/photos/')&&/\.(jpe?g|png|webp)$/i.test(u.pathname))||(u.protocol==='https:'&&((u.hostname==='i.imgur.com'&&/\.(jpe?g|png|webp)$/i.test(u.pathname))||(u.hostname==='res.cloudinary.com'&&u.pathname.includes('/image/upload/'))))}catch{return false}};
const clean=p=>p&&sections.includes(p.section)&&valid(p.url);
function apply(items){
const photos=items.filter(clean).filter(p=>p.active!==false);
const story=photos.filter(p=>p.section===sections[1]);
if(story.length){const grid=document.querySelector('.vl-geovanny-story-grid');if(grid){const sample=grid.querySelector('a');if(sample){grid.replaceChildren();story.forEach((p,i)=>{const card=sample.cloneNode(true),img=card.querySelector('img'),strong=card.querySelector('strong'),small=card.querySelector('small');if(img){img.src=new URL(p.url,location.href).href;img.alt=p.title||'Fotografía de Loja';img.loading='lazy'}if(strong)strong.textContent=p.title||'Loja en imágenes';if(small)small.textContent=String(i+1).padStart(2,'0')+' · LOJA';grid.appendChild(card)})}}}
const gallery=photos.filter(p=>p.section===sections[2]);
if(gallery.length){const grid=document.querySelector('.vl-photo-gallery-grid');if(grid){const sample=grid.querySelector('figure');if(sample){grid.replaceChildren();gallery.forEach((p,i)=>{const card=sample.cloneNode(true),img=card.querySelector('img'),label=card.querySelector('figcaption span');if(img){img.id='vl-gallery-managed-'+i;img.src=new URL(p.url,location.href).href;img.alt=p.title||'Fotografía de Loja';img.loading='lazy'}if(label)label.textContent=p.title||'Loja';grid.appendChild(card)})}}}
const hero=photos.filter(p=>p.section===sections[0]);
if(hero.length){const container=document.getElementById('heroSlidesContainer');if(container){const sample=container.querySelector('img.hero-slide');if(sample){container.replaceChildren();hero.forEach((p,i)=>{const img=sample.cloneNode(true);img.src=new URL(p.url,location.href).href;img.alt=p.title||'Loja';img.classList.toggle('active',i===0);container.appendChild(img)})}}}
}
function boot(){if(!window.firebase?.apps?.length){setTimeout(boot,500);return}const app=firebase.apps.find(a=>a.name==='viveLojaPublic');if(!app){setTimeout(boot,500);return}app.firestore().collection('settings').doc('main').get().then(s=>{const items=s.data()?.photoManagerItems;if(Array.isArray(items))apply(items)}).catch(e=>console.warn('Biblioteca fotográfica no disponible:',e.code||e.message))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
