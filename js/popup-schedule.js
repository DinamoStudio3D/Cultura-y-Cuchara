/* Entry announcement scheduling in continental Ecuador (UTC-05:00). */
(function(root){
 'use strict';
 function fromInput(value){if(!value)return null;const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);if(!match)throw Error('Revisa la fecha y hora del anuncio.');const [,y,m,d,h,min,sec='0']=match,stamp=Date.UTC(+y,+m-1,+d,+h,+min,+sec),check=new Date(stamp);if(+y<2000||check.getUTCFullYear()!==+y||check.getUTCMonth()!==+m-1||check.getUTCDate()!==+d||+h>23||+min>59||+sec>59)throw Error('Revisa la fecha y hora del anuncio.');return new Date(stamp+5*3600000).toISOString();}
 function stamp(value){if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value))return NaN;return Date.parse(value);}
 function toInput(value){const time=stamp(value);if(time===null||!Number.isFinite(time))return '';return new Date(time-5*3600000).toISOString().slice(0,16);}
 function validate(value){const start=stamp(value.popupStartsAt),end=stamp(value.popupEndsAt);if((start!==null&&!Number.isFinite(start))||(end!==null&&!Number.isFinite(end)))return 'Revisa la fecha y hora de inicio y fin del anuncio.';if(start!==null&&end!==null&&end<=start)return 'La fecha y hora de fin debe ser posterior al inicio.';return '';}
 function state(value={},now=Date.now()){if(validate(value))return 'invalid';if(value.popupActive!==true)return 'off';const start=stamp(value.popupStartsAt),end=stamp(value.popupEndsAt);if(end!==null&&now>=end)return 'expired';if(start!==null&&now<start)return 'scheduled';return 'active';}
 function normalizeQueue(data={}){data=data&&typeof data==='object'?data:{};return{active:data.active===true,items:(Array.isArray(data.items)?data.items:[]).filter(x=>x&&typeof x==='object').map(x=>({id:String(x.id||''),popupActive:x.popupActive===true,popupTitle:String(x.popupTitle||'').slice(0,120),popupDesc:String(x.popupDesc||'').slice(0,500),popupImg:String(x.popupImg||'').slice(0,2000),popupWhatsapp:String(x.popupWhatsapp||'').slice(0,2000),popupStartsAt:x.popupStartsAt||null,popupEndsAt:x.popupEndsAt||null}))};}
 function validateQueue(data){const q=normalizeQueue(data),ids=new Set();if(q.items.length>200)return 'Puedes guardar hasta 200 anuncios.';for(const x of q.items){if(!x.id||ids.has(x.id))return 'Cada anuncio necesita un identificador único.';ids.add(x.id);const error=validate(x);if(error)return (x.popupTitle||'Anuncio')+': '+error;if(x.popupActive&&!x.popupTitle.trim())return 'Escribe un título para cada anuncio habilitado.';for(const key of ['popupImg','popupWhatsapp'])if(x[key]&&!/^https:\/\//i.test(x[key])&&!/^\/(?!\/)/.test(x[key])&&!/^assets\//.test(x[key]))return 'Usa enlaces HTTPS para las imágenes y botones.';}
 const enabled=q.items.filter(x=>x.popupActive).sort((a,b)=>(stamp(a.popupStartsAt)??-Infinity)-(stamp(b.popupStartsAt)??-Infinity));for(let i=1;i<enabled.length;i++)if((stamp(enabled[i].popupStartsAt)??-Infinity)<(stamp(enabled[i-1].popupEndsAt)??Infinity))return 'Los horarios de «'+enabled[i-1].popupTitle+'» y «'+enabled[i].popupTitle+'» se solapan. Ajusta sus fechas para mostrar solo uno a la vez.';return '';}
 function create({show,hide,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout,delay=1500}){
  let value={},timer=null,waiting='',due=0,selected='';const seen=new Set();
  function check(){if(timer!==null)clearTimer(timer);timer=null;const time=now();let next=Infinity;
   const queued=Object.prototype.hasOwnProperty.call(value,'popupQueue'),queue=queued?normalizeQueue(value.popupQueue||{}):null;
   const items=queued?(queue.active?queue.items:[]):[value],candidate=items.find(x=>state(x,time)==='active');
   const identity=candidate?JSON.stringify([candidate.id,candidate.popupActive,candidate.popupStartsAt,candidate.popupEndsAt,candidate.popupTitle,candidate.popupDesc,candidate.popupImg,candidate.popupWhatsapp]):'';
   if(identity!==selected){hide();selected=identity;waiting='';due=0;}
   if(candidate&&!seen.has(identity)){if(waiting!==identity){waiting=identity;due=time+delay;}if(time>=due){if(show(candidate)!==false)seen.add(identity);else next=time+10000;}else next=due;}
   for(const item of items)if(item.popupActive&&!validate(item))for(const boundary of [stamp(item.popupStartsAt),stamp(item.popupEndsAt)])if(boundary!==null&&boundary>time)next=Math.min(next,boundary);
   if(Number.isFinite(next))timer=setTimer(check,Math.min(Math.max(1,next-time),3600000));
  }
  return{update(settings){value=settings||{};check();},check,destroy(){if(timer!==null)clearTimer(timer);timer=null;hide();}};
 }
 const api={fromInput,toInput,validate,state,normalizeQueue,validateQueue,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.VisitaLojaPopupSchedule=api;
})(typeof window==='object'?window:globalThis);
