/* Test-only scope /push-test/. Does not replace the site's PWA worker. */
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.stopImmediatePropagation();
 event.waitUntil(self.clients.openWindow(new URL('/push-test.html',self.location.origin).href));
});
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:'AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE',authDomain:'cultura-y-cuchara.firebaseapp.com',projectId:'cultura-y-cuchara',messagingSenderId:'974351327730',appId:'1:974351327730:web:08573026a46d1bb6598b6b'});
firebase.messaging().onBackgroundMessage(payload=>self.registration.showNotification(payload.data?.title||'VisitaLoja',{body:payload.data?.body||'',icon:'/visita-loja-icon-512.png',tag:'visitaloja-push-test'}));
