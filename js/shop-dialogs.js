/* Presentation only: cart and checkout keep their existing commerce logic. */
(function(root){
 'use strict';
 const ids=['cartModal','checkoutModal'],openers=new Map();
 const visible=()=>ids.map(id=>document.getElementById(id)).filter(node=>node&&!node.classList.contains('hidden'));
 const controls=dialog=>Array.from(dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(node=>node.getClientRects().length&&node.tabIndex!==-1);
 function open(id){
  if(!ids.includes(id))return;
  const dialog=document.getElementById(id);if(!dialog)return;
  if(dialog.classList.contains('hidden'))openers.set(id,document.activeElement);
  dialog.classList.remove('hidden');dialog.setAttribute('aria-hidden','false');
  document.body.classList.add('overflow-hidden');
  const target=controls(dialog)[0];if(target)target.focus();else{dialog.setAttribute('tabindex','-1');dialog.focus();}
 }
 function close(id){
  if(!ids.includes(id))return;
  const dialog=document.getElementById(id);if(!dialog)return;
  dialog.classList.add('hidden');dialog.setAttribute('aria-hidden','true');
  const remaining=visible();document.body.classList.toggle('overflow-hidden',!!remaining.length);
  const opener=openers.get(id);openers.delete(id);
  if(opener&&opener.isConnected!==false&&!opener.closest?.('.hidden')&&(!remaining.length||remaining.some(node=>node.contains(opener))))opener.focus?.();
 }
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'&&event.key!=='Tab')return;
  const dialog=visible().at(-1);if(!dialog)return;
  if(event.key==='Escape'){event.preventDefault();close(dialog.id);return;}
  const items=controls(dialog),first=items[0],last=items.at(-1);
  if(!items.length){event.preventDefault();dialog.setAttribute('tabindex','-1');dialog.focus();return;}
  if(!dialog.contains(document.activeElement)||(event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last)){
   event.preventDefault();(event.shiftKey?last:first).focus();
  }
 });
 root.VisitaLojaShopDialogs={open,close};
})(window);
