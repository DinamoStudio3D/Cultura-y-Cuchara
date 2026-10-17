/* Lightweight entry for printed /?qr= links. Never boot the tourism homepage. */
(function(root){'use strict';
 function destination(id,data,origin){
  if(!/^[a-z0-9_-]{1,100}$/i.test(id||''))throw Error('invalid-id');
  if(!data)throw Error('not-found');
  if(data.menuImageUrl&&!data.visit?.placeId)return new URL('/menu-digital.html?id='+encodeURIComponent(id),origin).href;
  const target=String(data.targetUrl||'').trim();if(!target)throw Error('no-target');
  const url=new URL(target,origin);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('invalid-target');
  const owned=url.hostname===new URL(origin).hostname||['visitaloja.com','www.visitaloja.com'].includes(url.hostname)||/\.vercel\.app$/i.test(url.hostname);
  if(owned&&url.pathname==='/menu-digital.html'&&url.searchParams.get('id')===id){url.protocol=new URL(origin).protocol;url.host=new URL(origin).host;}
  if(url.origin===origin&&['/','/index.html','/qr.html'].includes(url.pathname)&&url.searchParams.has('qr'))throw Error('loop');
  return url.href;
 }
 if(typeof module==='object'&&module.exports)module.exports={destination};
 if(typeof document==='undefined')return;
 const id=new URLSearchParams(location.search).get('qr'),title=document.getElementById('qrTitle'),message=document.getElementById('qrMessage'),spinner=document.getElementById('qrSpinner'),retry=document.getElementById('qrRetry');
 let generation=0;
 async function resolve(){const revision=++generation;retry.hidden=true;spinner.hidden=false;title.textContent='Abriendo tu QR';message.textContent='Estamos preparando tu contenido.';let timer;
 try{
  if(!/^[a-z0-9_-]{1,100}$/i.test(id||''))throw Error('invalid-id');
  if(!root.firebase?.firestore)throw Error('connection');
  const app=root.firebase.apps.find(a=>a.name==='qrEntry')||root.firebase.initializeApp({apiKey:'AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE',authDomain:'cultura-y-cuchara.firebaseapp.com',projectId:'cultura-y-cuchara',appId:'1:974351327730:web:08573026a46d1bb6598b6b'},'qrEntry');
  const snapshot=await Promise.race([app.firestore().collection('qrCodes').doc(id).get({source:'server'}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),15000);})]);
  if(revision!==generation)return;location.replace(destination(id,snapshot.exists?snapshot.data():null,location.origin));
 }catch(error){if(revision!==generation)return;spinner.hidden=true;const missing=['invalid-id','not-found','no-target','invalid-target','loop'].includes(error.message);title.textContent=missing?'No encontramos este contenido':'No pudimos abrir el QR';message.textContent=missing?'Comprueba que el enlace esté completo o consulta con el establecimiento.':'Comprueba tu conexión e inténtalo de nuevo.';retry.hidden=missing;
 }finally{clearTimeout(timer);}}
 retry.addEventListener('click',resolve);resolve();
})(typeof window!=='undefined'?window:globalThis);
