/* Presentation and client-side checks only; server permissions remain authoritative. */
(function(root){
 'use strict';
 function expiry(value){try{if(value===null||value===undefined||value==='')return null;const result=typeof value.toMillis==='function'?value.toMillis():typeof value.seconds==='number'?value.seconds*1000:new Date(value).getTime();return Number.isFinite(result)?result:null;}catch(_){return null;}}
 function state(item,now=Date.now()){
  const expires=expiry(item.expiresAt);
  if(item.status==='delivered')return {label:'Ya entregado',canDeliver:false,reason:'already-used'};
  if(['cancelled','reversed','void'].includes(item.status))return {label:'Anulado',canDeliver:false,reason:'cancelled'};
  if(item.status==='expired'||item.type==='loyalty'&&expires!==null&&expires<=now)return {label:'Vencido',canDeliver:false,reason:'expired'};
  if(item.status!=='pending')return {label:'No disponible',canDeliver:false,reason:'unknown'};
  if(item.type==='loyalty'&&expires===null)return {label:'Vigencia por confirmar',canDeliver:false,reason:'unknown-expiry'};
  return {label:'Pendiente por entregar',canDeliver:true,reason:null};
 }
 root.VisitaLojaMerchantRewardState={state,expiry};
})(window);
