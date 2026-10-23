/* One published QR menu, shared by printed codes and business pages. */
(function(root){
 'use strict';
 const validId=id=>typeof id==='string'&&/^[a-z0-9_-]{1,100}$/i.test(id);
 function available(id,data){
  if(!validId(id)||!data||data.active===false||data.visit?.placeId)return false;
  try{const image=new URL(data.menuImageUrl),target=new URL(data.targetUrl,'https://www.visitaloja.com');return image.protocol==='https:'&&!image.username&&!image.password&&['res.cloudinary.com','i.imgur.com'].includes(image.hostname)&&target.protocol==='https:'&&(['visitaloja.com','www.visitaloja.com'].includes(target.hostname)||/^visitaloja-[a-z0-9]+-dinamostudio3d\.vercel\.app$/.test(target.hostname))&&target.pathname==='/menu-digital.html'&&target.searchParams.get('id')===id;}catch(_){return false;}
 }
 const path=id=>validId(id)?'/menu-digital.html?id='+encodeURIComponent(id):'';
 const bindings=new WeakMap();let dialog=null,frame=null,launcher=null,previousOverflow='';
 function close(){dialog?.close();}
 function open(id,title,language,button){
  if(!validId(id))return;
  if(!dialog){dialog=document.createElement('dialog');dialog.className='place-digital-menu-dialog';dialog.setAttribute('aria-labelledby','digitalMenuDialogTitle');const header=document.createElement('header'),heading=document.createElement('h2'),exit=document.createElement('button');heading.id='digitalMenuDialogTitle';exit.type='button';exit.className='place-digital-menu-close';exit.onclick=close;exit.setAttribute('data-menu-close','');header.append(heading,exit);frame=document.createElement('iframe');frame.className='place-digital-menu-frame';dialog.append(header,frame);document.body.append(dialog);dialog.addEventListener('close',()=>{frame.removeAttribute('src');document.body.style.overflow=previousOverflow;launcher?.focus({preventScroll:true});});dialog.addEventListener('click',event=>{if(event.target===dialog)close();});}
  if(dialog.open)dialog.close();launcher=button;dialog.querySelector('h2').textContent=(language==='en'?'Menu · ':'Menú · ')+title;dialog.querySelector('button').textContent=language==='en'?'Close ✕':'Cerrar ✕';frame.title=language==='en'?'Digital menu':'Menú digital';frame.src=path(id);previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();
 }
 async function attach(button,place,db,language='es'){
  if(!button)return false;const generation={};bindings.set(button,generation);button.hidden=true;button.onclick=null;
  const id=place?.menuQrId;if(!validId(id))return false;
  try{const snapshot=await db.collection('qrCodes').doc(id).get({source:'server'});if(bindings.get(button)!==generation)return false;if(!snapshot.exists||!available(id,snapshot.data()))return false;
   button.textContent=language==='en'?'View menu':'Ver menú';button.setAttribute('aria-haspopup','dialog');button.hidden=false;button.onclick=()=>open(id,place.title||'',language,button);return true;
  }catch(_){return false;}
 }
 const api={validId,available,path,attach,close};if(typeof module==='object'&&module.exports)module.exports=api;else root.VisitaLojaDigitalMenu=api;
})(typeof window==='object'?window:globalThis);
