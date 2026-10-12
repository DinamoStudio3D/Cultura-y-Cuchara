/* Customer navigation never creates visits, points, subscriptions or notifications. */
(function(root){
 'use strict';
 const nav=document.getElementById('customerWorkspaceNav');if(!nav)return;
 const views={
  es:{cards:['Tarjetas y premios','MI PROGRESO','Consulta tus sellos, el progreso de cada negocio y las recompensas de tus tarjetas.'],history:['Mis visitas','HISTORIAL','Revisa las visitas que ya fueron registradas. Para registrar otra, abre la tarjeta del negocio y elige Registrar visita.'],birthdays:['Cumpleaños','OFERTAS DISPONIBLES','Consulta los beneficios de cumpleaños que estén disponibles para tu cuenta y revisa sus condiciones.'],points:['Puntos por negocio','EN PREPARACIÓN','Los puntos de cada negocio son independientes. Una tarjeta de ejemplo no representa tu saldo ni entrega premios. Consulta el servicio antes de realizar una operación.'],notices:['Mis avisos','EN PREPARACIÓN','Consulta los avisos del servicio cuando esté disponible. Los permisos para recibir promociones se gestionan en Puntos; abrir esta pantalla no activa ninguna suscripción.']},
  en:{cards:['Cards and rewards','MY PROGRESS','Check your stamps, progress at each business and card rewards.'],history:['My visits','HISTORY','Review recorded visits. To register another, open the business card and select Register visit.'],birthdays:['Birthdays','AVAILABLE OFFERS','Check birthday benefits available to your account and review their conditions.'],points:['Points by business','IN PREPARATION','Each business has its own points. An example card is not your balance and does not grant rewards. Check the service before taking an action.'],notices:['My notices','IN PREPARATION','Check service notices when available. Promotion preferences are managed under Points; opening this page does not subscribe you.']}
 };
 const labels={en:{cards:['Cards and rewards','My progress'],history:['My visits','History'],birthdays:['Birthdays','Available offers'],points:['Points','In preparation'],notices:['Notices','In preparation']}};
 let current='cards';
 const english=()=>document.documentElement.lang==='en';
 function availability(){
  const notice=document.getElementById('customerPaneEmpty');
  const target=current==='history'?document.getElementById('walletHistoryCard'):current==='birthdays'?document.getElementById('birthdayPanel'):null;
  notice.hidden=!target||!target.classList.contains('hidden');
  if(!notice.hidden){const signedIn=typeof auth!=='undefined'&&Boolean(auth.currentUser);notice.textContent=!signedIn?(english()?'Sign in to view your information.':'Ingresa para consultar tu información.'):(current==='history'?(english()?'No recorded visits are available yet.':'Todavía no hay visitas registradas disponibles.'):(english()?'No birthday offers are available for your account at this time.':'No hay ofertas de cumpleaños disponibles para tu cuenta en este momento.'));}
 }
 function select(view,focus=false){
  if(!views.es[view])return false;current=view;
  document.querySelectorAll('[data-customer-pane]').forEach(pane=>pane.hidden=pane.dataset.customerPane!==view);
  nav.querySelectorAll('[data-customer-view]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.customerView===view));const key=button.dataset.customerView,label=english()?labels.en[key]:[views.es[key][0],key==='cards'?'Mi progreso':key==='history'?'Historial':key==='birthdays'?'Ofertas disponibles':'En preparación'];button.querySelector('strong').textContent=label[0];button.querySelector('small').textContent=label[1];});
  const [title,state,description]=views[english()?'en':'es'][view];
  document.getElementById('customerPaneTitle').textContent=title;document.getElementById('customerPaneState').textContent=state;document.getElementById('customerPaneDescription').textContent=description;
  availability();
  if(focus){const heading=document.getElementById('customerPaneTitle');heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  return true;
 }
 nav.addEventListener('click',event=>{const button=event.target.closest('[data-customer-view]');if(button&&nav.contains(button))select(button.dataset.customerView,true);});
 root.addEventListener('visitaloja:loyalty-language',()=>select(current));
 root.addEventListener('visitaloja:wallet-rendered',availability);
 for(const id of ['walletHistoryCard','birthdayPanel']){const node=document.getElementById(id);if(node)new MutationObserver(availability).observe(node,{attributes:true,attributeFilter:['class']});}
 if(typeof auth!=='undefined')auth.onAuthStateChanged(()=>select('cards'));
 root.VisitaLojaCustomerWorkspace={select};select('cards');
})(window);
