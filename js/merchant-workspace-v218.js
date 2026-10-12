/* Navigation only. Existing forms, listeners, permissions and service gates stay intact. */
(function(root){
 'use strict';
 const nav=document.getElementById('merchantWorkspaceNav');if(!nav)return;
 const views={
  overview:['Resumen','CONSULTA','Selecciona una parada y consulta los resultados disponibles para tu plan.'],
  clients:['Clientes','CONSULTA · SEGÚN TU PLAN','Consulta el progreso de las tarjetas por visitas y encuentra a tus clientes frecuentes.'],
  visits:['Visitas','HISTORIAL','Revisa las visitas ya confirmadas. Para registrar una nueva, utiliza Confirmar visitas en la cabecera.'],
  rewards:['Premios','RECOMPENSAS POR VISITAS','Consulta los premios generados por las tarjetas de visitas. Validar premios permite comprobar un código de retiro.'],
  benefits:['Beneficios por puntos','EN PREPARACIÓN','Prepara las reglas y recompensas de esta parada. Un borrador o una simulación no concede puntos ni entrega un premio real. La publicación conserva sus controles de autorización.'],
  promotions:['Promociones','BORRADORES','Prepara ofertas con fechas y condiciones para tus clientes. Guardar un borrador no publica ni envía la promoción.'],
  birthdays:['Cumpleaños','CONFIGURACIÓN Y BORRADORES','Configura el beneficio y sus días de vigencia. Activar la campaña y guardar son acciones explícitas; los ejemplos están separados debajo.'],
  notices:['Avisos','EN PREPARACIÓN','Revisa el estado del servicio antes de publicar. Solo puede entregar avisos a seguidores con consentimiento y con autorización del administrador.']
 };
 let current='overview';
 const gated=new Set(['clients','visits','rewards']);
 function syncAvailability(){
  const analytics=document.getElementById('analyticsPanel'),notice=document.getElementById('merchantWorkspaceUnavailable');
  if(notice)notice.hidden=!(gated.has(current)&&analytics?.classList.contains('hidden'));
 }
 function select(view,focus=false){
  if(!views[view])return false;
  current=view;
  document.querySelectorAll('[data-merchant-pane]').forEach(pane=>{pane.hidden=pane.dataset.merchantPane!==view;});
  nav.querySelectorAll('[data-merchant-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.merchantView===view)));
  const [title,state,description]=views[view];
  document.getElementById('merchantPaneTitle').textContent=title;
  document.getElementById('merchantPaneState').textContent=state;
  document.getElementById('merchantPaneDescription').textContent=description;
  syncAvailability();
  if(focus){const heading=document.getElementById('merchantPaneTitle');heading.focus({preventScroll:true});heading.scrollIntoView({behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
  return true;
 }
 nav.addEventListener('click',event=>{const button=event.target.closest('[data-merchant-view]');if(button&&nav.contains(button))select(button.dataset.merchantView,true);});
 const analytics=document.getElementById('analyticsPanel');
 if(analytics)new MutationObserver(syncAvailability).observe(analytics,{attributes:true,attributeFilter:['class']});
 root.VisitaLojaMerchantWorkspace={select};
 select('overview');
})(window);
