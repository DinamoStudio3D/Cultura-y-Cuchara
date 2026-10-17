/* Pure validation shared by the browser, Cloudflare Worker and Firebase callable. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VisitaLojaConsumption=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
function fail(message){const e=new Error(message);e.code='invalid-argument';throw e;}
function reason(value,label='Motivo'){const text=typeof value==='string'?value.trim():'';if(text.length<5||text.length>240)fail(label+' obligatorio: escribe entre 5 y 240 caracteres.');return text;}
function validate(input={},place={},program={}){
 const tourist=place.category==='turismo',recordKind=input.recordKind||(tourist?'tourism':'purchase');
 if(!['purchase','courtesy','tourism'].includes(recordKind))fail('Tipo de registro inválido.');
 if(recordKind==='tourism'&&!tourist)fail('Esta parada requiere registrar una compra o una cortesía.');
 if(tourist&&recordKind!=='tourism')fail('Esta parada turística se registra como visita sin consumo.');
 const raw=input.purchaseAmount,missing=raw==null||!['string','number'].includes(typeof raw)||(typeof raw==='string'&&!raw.trim()),amount=Number(raw);
 let purchaseAmount=0,consumptionReason='';
 if(recordKind==='purchase'){
  if(missing||!Number.isFinite(amount)||amount<=0||amount>100000||Math.abs(amount*100-Math.round(amount*100))>0.000001)fail('Indica un consumo mayor a cero, con máximo dos decimales y hasta $100.000.');
  purchaseAmount=Math.round(amount*100)/100;
  const minimum=Number(program.minimumSpend||0);if(Number.isFinite(minimum)&&purchaseAmount<minimum)fail('El consumo mínimo para obtener un sello es $'+minimum.toFixed(2)+'.');
 }else{
  if(!missing&&(!Number.isFinite(amount)||amount!==0))fail('Las cortesías y visitas turísticas deben tener consumo cero.');
  if(recordKind==='courtesy')consumptionReason=reason(input.consumptionReason,'Motivo de la cortesía');
 }
 const receiptRef=String(input.receiptRef||'').trim();if(receiptRef.length>80)fail('El comprobante no puede superar 80 caracteres.');
 return{recordKind,purchaseAmount,consumptionReason,receiptRef,consumptionPolicyVersion:1};
}
return Object.freeze({validate,reason});
});
