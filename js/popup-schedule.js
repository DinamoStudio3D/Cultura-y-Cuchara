/* Entry announcement scheduling in continental Ecuador (UTC-05:00). */
(function(root){
 'use strict';
 function fromInput(value){if(!value)return null;const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);if(!match)throw Error('Revisa la fecha y hora del anuncio.');const [,y,m,d,h,min,sec='0']=match,stamp=Date.UTC(+y,+m-1,+d,+h,+min,+sec),check=new Date(stamp);if(+y<2000||check.getUTCFullYear()!==+y||check.getUTCMonth()!==+m-1||check.getUTCDate()!==+d||+h>23||+min>59||+sec>59)throw Error('Revisa la fecha y hora del anuncio.');return new Date(stamp+5*3600000).toISOString();}
 function stamp(value){if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value))return NaN;return Date.parse(value);}
 function toInput(value){const time=stamp(value);if(time===null||!Number.isFinite(time))return '';return new Date(time-5*3600000).toISOString().slice(0,16);}
 function validate(value){const start=stamp(value.popupStartsAt),end=stamp(value.popupEndsAt);if((start!==null&&!Number.isFinite(start))||(end!==null&&!Number.isFinite(end)))return 'Revisa la fecha y hora de inicio y fin del anuncio.';if(start!==null&&end!==null&&end<=start)return 'La fecha y hora de fin debe ser posterior al inicio.';return '';}
 function state(value={},now=Date.now()){if(validate(value))return 'invalid';if(value.popupActive!==true)return 'off';const start=stamp(value.popupStartsAt),end=stamp(value.popupEndsAt);if(end!==null&&now>=end)return 'expired';if(start!==null&&now<start)return 'scheduled';return 'active';}
 function create({show,hide,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout,delay=1500}){
  let value={},timer=null,waiting='',due=0;const seen=new Set();
  const key=()=>JSON.stringify([value.popupActive,value.popupStartsAt,value.popupEndsAt,value.popupTitle,value.popupDesc,value.popupImg,value.popupWhatsapp]);
  function check(){if(timer!==null)clearTimer(timer);timer=null;const time=now(),current=state(value,time),identity=key();let next=Infinity;
   if(current!=='active'){hide();waiting='';due=0;}else if(!seen.has(identity)){if(waiting!==identity){waiting=identity;due=time+delay;}if(time>=due){if(show(value)!==false)seen.add(identity);else next=time+10000;}else next=due;}
   if(current!=='off'&&current!=='invalid')for(const boundary of [stamp(value.popupStartsAt),stamp(value.popupEndsAt)])if(boundary!==null&&boundary>time)next=Math.min(next,boundary);
   if(Number.isFinite(next))timer=setTimer(check,Math.min(Math.max(1,next-time),3600000));
  }
  return{update(settings){value=settings||{};check();},check,destroy(){if(timer!==null)clearTimer(timer);timer=null;hide();}};
 }
 const api={fromInput,toInput,validate,state,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.VisitaLojaPopupSchedule=api;
})(typeof window==='object'?window:globalThis);
