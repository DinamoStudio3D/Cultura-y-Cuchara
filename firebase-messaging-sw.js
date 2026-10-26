/* Dedicated messaging scopes; the site's PWA worker remains unchanged. */
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.stopImmediatePropagation();
 let url=new URL('/',self.location.origin);try{const requested=new URL(event.notification.data?.url||'/push-test.html',self.location.origin);if(requested.origin===self.location.origin)url=requested;}catch(_){}
 event.waitUntil(self.clients.openWindow(url.href));
});
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:'AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE',authDomain:'cultura-y-cuchara.firebaseapp.com',projectId:'cultura-y-cuchara',messagingSenderId:'974351327730',appId:'1:974351327730:web:08573026a46d1bb6598b6b'});
firebase.messaging().onBackgroundMessage(payload=>self.registration.showNotification(payload.data?.title||'VisitaLoja',{body:payload.data?.body||'',icon:'/visita-loja-icon-512.png',tag:payload.data?.tag||'visitaloja-push-test',data:{url:payload.data?.url||'/push-test.html'}}));
