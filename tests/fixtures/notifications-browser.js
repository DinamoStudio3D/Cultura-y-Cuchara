/* Explicit visual fixture. No network calls, real authentication or push delivery. */
(function(){
 const admin=document.body.dataset.pushAdmin==='true',user={uid:'review-user',email:'demostracion@example.test',getIdToken:async()=> 'fixture-only'},campaigns=[{id:'review-campaign-01',title:'Un fin de semana para descubrir Loja',message:'Cultura, sabores y nuevos lugares te esperan. Revisa la agenda y elige tu próximo plan.',url:'/#agenda',createdAt:Date.now()-3600000,createdBy:user.uid,status:'prepared',total:3,testedAt:Date.now(),counts:{accepted:0,pending:3,failed:0,skipped:0,uncertain:0}}];
 let active=false;
 Object.defineProperty(window,'Notification',{value:{permission:'default',requestPermission:async()=> 'granted'},configurable:true});
 Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>({active:true})},configurable:true});
 const auth={currentUser:user,onAuthStateChanged:callback=>Promise.resolve().then(()=>callback(user)),signInWithPopup:async()=>{}};
 const messaging={onMessage(){},getToken:async()=> 'fixture:device-token'.padEnd(60,'x'),deleteToken:async()=>true};
 function messagingFactory(){return messaging;}messagingFactory.isSupported=async()=>true;
 function authFactory(){return auth;}authFactory.GoogleAuthProvider=function(){};
 window.firebase={initializeApp:()=>({auth:()=>auth}),auth:authFactory,messaging:messagingFactory};
 window.fetch=async(url,options)=>{if(url!=='/api/notifications')throw Error('Fixture blocked unexpected network request');const input=JSON.parse(options.body);let result;
 switch(input.action){case 'config':result={vapidKey:'B'.repeat(87)};break;case 'overview':result={devices:3,overLimit:false,campaigns:admin?campaigns:[]};break;case 'subscribe':active=true;result={active:true,deviceId:'a'.repeat(64)};break;case 'unsubscribe':active=false;result={active:false};break;case 'device':result={active};break;case 'prepare':result={id:input.campaignId,title:input.title,message:input.message,url:input.url,createdAt:Date.now(),status:'prepared',total:3,counts:{accepted:0,pending:3,failed:0,skipped:0,uncertain:0}};campaigns.unshift(result);break;case 'detail':result=campaigns.find(c=>c.id===input.campaignId);break;case 'test':campaigns.find(c=>c.id===input.campaignId).testedAt=Date.now();result={accepted:true,message:'Demostración: no se ha enviado ninguna notificación.'};break;case 'dispatch':result=campaigns.find(c=>c.id===input.campaignId);result.status='completed';result.counts={accepted:3,pending:0,failed:0,skipped:0,uncertain:0};break;default:throw Error('Unsupported fixture action');}
 return {ok:true,json:async()=>structuredClone(result)};
 };
})();
