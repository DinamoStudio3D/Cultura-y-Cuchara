/* Explicitly configured transport for an isolated V2 backend. Never auto-connects. */
(function(root){
 'use strict';
 function create({app,endpoint,fetchImpl=root.fetch.bind(root)}){
  const projectId=app?.options?.projectId,url=new URL(endpoint),host=root.location?.hostname;
  if(!projectId||projectId==='cultura-y-cuchara'||['visitaloja.com','www.visitaloja.com'].includes(host))throw Error('Usa una cuenta y una web de pruebas aisladas.');
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||['visitaloja.com','www.visitaloja.com'].includes(url.hostname))throw Error('El servicio requiere una dirección HTTPS de pruebas.');
  const base=url.href.replace(/\/$/,'')+'/reward-programs-v2/';
  const allowed=new Set(['admin/load','admin/inspect-transition','admin/save-draft','admin/publish','customer/enroll','customer/claim','customer/expire-claim','merchant/expire-claim','customer/wallet','customer/catalog','customer/visit-code','merchant/confirm-visit','merchant/reverse-visit','merchant/lookup-claim','merchant/credit-visit','merchant/reconcile-reversal','merchant/deliver']);
  async function call(action,input={}){
   if(!allowed.has(action))throw Error('Operación desconocida.');
   const auth=app.auth(),user=auth.currentUser;
   if(!user)throw Error('Inicia sesión en la cuenta de pruebas.');
   const token=await user.getIdToken();
   if(auth.currentUser?.uid!==user.uid)throw Error('La sesión cambió.');
   const controller=new AbortController(),timeout=root.setTimeout(()=>controller.abort(),20000);
   try{
    const response=await fetchImpl(base+action,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input)});
    const result=await response.json();
    if(auth.currentUser?.uid!==user.uid)throw Error('La sesión cambió. Recarga antes de continuar.');
    if(!response.ok||result.ok!==true){const error=Error(result.error==='conflict'?'La configuración cambió. Recarga antes de guardar.':'No se pudo completar la operación. Consulta el estado antes de repetirla.');error.code=result.error||'request-failed';throw error;}
    return result.data;
   }finally{root.clearTimeout(timeout);}
  }
  return Object.freeze({projectId,call});
 }
 root.VisitaLojaRewardProgramsClient=Object.freeze({create});
})(typeof window==='object'?window:globalThis);
