/* Navigation preserves the existing forms, data and service authorization gates. */
(function(root){
 'use strict';
 const nav=document.getElementById('adminFidelityNav');if(!nav)return;
 const views={
  overview:['Resumen de fidelidad','CONSULTA','Consulta resultados de los programas por visitas y las alertas que necesitan atención.'],
  programs:['Programas por visitas','CONFIGURACIÓN PUBLICADA AL GUARDAR','Configura las visitas necesarias y el premio de cada parada. Guardar programa actualiza el programa real; la tarjeta de muestra es solo una vista previa.'],
  access:['Accesos de negocios','ASIGNACIÓN REAL','Revisa las cuentas existentes y sus paradas. Guardar asignación cambia el acceso de ese negocio; crear cuentas corresponde al panel principal.'],
  clients:['Clientes por establecimiento','CONSULTA','Filtra el progreso acumulado de las tarjetas por visitas. Estos registros no equivalen a seguidores ni a saldos por puntos.'],
  activity:['Historial de visitas y premios','AUDITORÍA','Consulta movimientos por tipo, estado y fecha. El CSV respeta los filtros. Limpiar vencidos solo elimina códigos temporales caducados después de tu confirmación.'],
  points:['Puntos y beneficios','EN PREPARACIÓN','Supervisa las reglas y los beneficios por parada. Los ejemplos y borradores no conceden puntos; publicar depende del servicio y de sus permisos.'],
  promotions:['Promociones','BORRADORES','Prepara ofertas y condiciones. Guardar un borrador local no publica ni entrega avisos; los pasos del servicio están en Avisos.'],
  birthdays:['Campañas de cumpleaños','BORRADORES Y EJEMPLOS','Prepara los textos antes, durante y después del cumpleaños. Estos borradores y ejemplos no activan campañas ni envían notificaciones.'],
  notices:['Avisos y autorización','EN PREPARACIÓN','Supervisa permisos y estado del servicio. Guardar, publicar y entregar son acciones distintas; la entrega requiere consentimiento y un servicio habilitado.']
 };
 function select(view,focus=false){
  if(!views[view])return false;
  document.querySelectorAll('[data-fidelity-pane]').forEach(pane=>{pane.hidden=pane.dataset.fidelityPane!==view;});
  nav.querySelectorAll('[data-fidelity-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fidelityView===view)));
  const [title,state,description]=views[view];
  document.getElementById('fidelityPaneTitle').textContent=title;
  document.getElementById('fidelityPaneState').textContent=state;
  document.getElementById('fidelityPaneDescription').textContent=description;
  if(focus){const heading=document.getElementById('fidelityPaneTitle');heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  return true;
 }
 nav.addEventListener('click',event=>{const button=event.target.closest('[data-fidelity-view]');if(button&&nav.contains(button))select(button.dataset.fidelityView,true);});
 root.VisitaLojaAdminFidelityWorkspace={select};
 function openAnchor(){if(root.location?.hash==='#merchantAccessSection')select('access');}
 select('overview');openAnchor();
 root.addEventListener?.('hashchange',openAnchor);
})(window);
