/* Shared presentation of service failures; no retries, writes or activation. */
(function(root){
 'use strict';
 function message(error,{read=false,service='servicio'}={}){
  const code=String(error?.code||'').replace(/^functions\//,'');
  const text=String(error?.message||'').trim();
  if(read&&['not-found','unavailable'].includes(code))return `El servicio de ${service} aún no está disponible.`;
  if(['internal','unavailable','deadline-exceeded','unknown','network-request-failed'].includes(code)||/^(internal|unknown|FirebaseError|INTERNAL)(:|$)/i.test(text))return read?'No pudimos consultar el servicio. Inténtalo nuevamente más tarde.':'No se pudo confirmar el resultado. Consulta el estado antes de reintentar; la operación podría haberse completado.';
  if(['permission-denied','unauthorized'].includes(code))return 'Tu cuenta no tiene permiso para esta operación. Comprueba el negocio seleccionado o consulta al administrador.';
  if(['unauthenticated','auth/user-token-expired','auth/invalid-user-token'].includes(code))return 'Tu sesión ha vencido. Vuelve a iniciar sesión para continuar.';
  if(code==='resource-exhausted')return 'Se alcanzó el límite del servicio. Espera antes de volver a intentarlo.';
  if(['invalid-argument','failed-precondition','already-exists','out-of-range'].includes(code)&&text&&!/Firebase|https?:|stack|\bat\s+\S+\(/i.test(text))return text;
  if(code)return 'No se pudo completar la operación. Revisa los datos y consulta el estado antes de reintentar.';
  return text||'No se pudo completar la operación. Inténtalo nuevamente.';
 }
 root.VisitaLojaServiceErrors={message};
})(window);
