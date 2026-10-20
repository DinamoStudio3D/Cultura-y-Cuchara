(function(root){'use strict';
const dialog=root.document.getElementById('promoPopupModal');if(!dialog)return;
function open(){if(typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}else dialog.setAttribute('data-fallback','true');root.document.body.classList.add('vl-promo-open');}
function close(){if(dialog.open&&typeof dialog.close==='function')dialog.close();dialog.removeAttribute('data-fallback');root.document.body.classList.remove('vl-promo-open');}
function dismiss(){root.closeModal('promoPopupModal');}
dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
dialog.addEventListener('click',event=>{if(event.target===dialog)dismiss();});
dialog.addEventListener('close',()=>{close();if(!dialog.classList.contains('hidden'))dismiss();});
root.VisitaLojaPromoDialog={open,close};
})(window);