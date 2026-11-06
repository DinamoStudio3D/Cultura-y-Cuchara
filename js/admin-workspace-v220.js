/* Presentation metadata only: reuse existing navigation and form handlers. */
(function(root){
 'use strict';
 const areas={
  dashboard:['Inicio y seguimiento','Consulta el resumen y elige los pendientes que necesitas atender.','RESUMEN','inicio resumen'],
  control:['Inicio y seguimiento','Revisa las paradas que necesitan atención antes de publicar o actualizar su información.','REVISIÓN','pendientes revisión'],
  analytics:['Inicio y seguimiento','Consulta los resultados generales y utiliza los filtros para preparar tus reportes.','CONSULTA','estadísticas reportes resultados'],
  places:['Paradas, negocios y QR','Edita fichas, ubicación, fotos y publicación de cada parada. Los accesos de propietarios se gestionan en Cuentas de negocios.','FICHAS Y PUBLICACIÓN','fotos imágenes mapa ubicación negocio ficha'],
  merchants:['Paradas, negocios y QR','Crea accesos para propietarios y asigna sus paradas. La ficha pública se edita en Paradas y negocios.','ACCESOS DE PROPIETARIOS','contraseña correo dueño propietario acceso cuenta'],
  applications:['Paradas, negocios y QR','Revisa las solicitudes de nuevos negocios antes de incorporarlos a la plataforma.','SOLICITUDES','solicitudes registro inscripción'],
  subscriptions:['Paradas, negocios y QR','Administra planes, pagos y vencimientos de los establecimientos.','PLANES','pagos facturación vencimientos suscripciones'],
  cantons:['Paradas, negocios y QR','Organiza las guías, portadas, rutas y paradas de cada cantón.','CONTENIDO Y PUBLICACIÓN','cantones provincia rutas guía portada'],
  entrepreneurs:['Paradas, negocios y QR','Gestiona las fichas y la presentación de los emprendimientos.','DIRECTORIO','emprendimientos directorio'],
  users:['Pasaporte y fidelidad','Consulta los usuarios registrados y sus datos disponibles. Las cuentas de propietarios tienen su propio apartado.','CLIENTES','clientes turistas usuarios perfil'],
  fidelity:['Pasaporte y fidelidad','Supervisa los programas por negocio. Los estudios de puntos y avisos siguen en preparación; los borradores no activan el servicio.','SERVICIOS EN PREPARACIÓN','puntos promociones cumpleaños tarjetas sellos premios recompensa canje visitas temporadas parada'],
  qr:['Paradas, negocios y QR','Gestiona los códigos y enlaces de acceso a cada parada.','CÓDIGOS QR','qr códigos visitas escanear menús digitales suscripción'],
  chabaquito:['Chabaquito','Configura la presentación y las opciones del personaje en la web.','PERSONAJE','mascota personaje chabaquito'],
  chabaquitoMissions:['Chabaquito','Crea y revisa misiones, requisitos y recompensas antes de publicarlas.','MISIONES','misiones retos recompensas'],
  passport:['Pasaporte y fidelidad','Gestiona el pasaporte turístico y sus premios; la fidelidad de cada negocio se administra por separado.','PASAPORTE','pasaporte sellos premios turismo lojano turista recompensas canjes metas'],
  events:['Agenda y comunicación','Gestiona eventos, fechas, ubicaciones y afiches de la agenda.','AGENDA','eventos agenda afiche horarios cartelera programación'],
  festival:['Agenda y comunicación','Organiza las campañas y los contenidos del festival.','CAMPAÑAS','festival campañas fiavl programación'],
  brands:['Contenido y medios','Administra las marcas visibles en el carrusel de la web.','MARCAS','aliados patrocinadores logos carrusel'],
  notifications:['Agenda y comunicación','Envía avisos a los usuarios que activaron las notificaciones.','NOTIFICACIONES','push avisos usuarios'],
  stories:['Contenido y medios','Edita relatos, imágenes y publicación de las historias de Loja.','HISTORIAS','historia relatos'],
  podcast:['Contenido y medios','Administra los audios y su presentación en la web.','AUDIO','podcast audio música'],
  time:['Contenido y medios','Gestiona fotografías, relatos y audios históricos.','ARCHIVO TURÍSTICO','tiempo fotografías antiguas historia'],
  postcards:['Contenido y medios','Configura marcos y opciones para crear postales con la marca VisitaLoja.','POSTALES','postal marcos logo'],
  settings:['Ajustes y seguridad','Ajusta marca, presentación y opciones generales de la web. Revisa cada cambio antes de guardarlo.','CONFIGURACIÓN','apariencia marca logo colores portada anuncio especial entrada banner emergente popup video música'],
  admins:['Ajustes y seguridad','Gestiona quién puede administrar la plataforma. Estos accesos son distintos de las cuentas de negocios.','ACCESOS ADMINISTRATIVOS','administradores permisos seguridad acceso contraseña'],
  links:['Agenda y comunicación','Consulta y configura los enlaces del sistema para compartirlos.','ENLACES','enlaces compartir redes'],
  maintenance:['Ajustes y seguridad','Controla el estado de la web y las opciones de mantenimiento.','ESTADO DE LA WEB','mantenimiento estado web'],
  audit:['Ajustes y seguridad','Consulta el registro disponible de acciones administrativas.','SUPERVISIÓN','auditoría historial acciones']
 };
 function update(module){
  const info=areas[module];if(!info)return false;
  for(const [id,value] of [['adminModuleArea',info[0]],['adminModuleDescription',info[1]],['adminModuleState',info[2]]]){const node=document.getElementById(id);if(node)node.textContent=value;}
  return true;
 }
 for(const [module,info] of Object.entries(areas)){const button=document.getElementById(module+'NavBtn');if(button)button.dataset.searchTerms=info[3];}
 root.VisitaLojaAdminWorkspace={update};
 update(typeof currentAdminModule==='string'?currentAdminModule:'dashboard');
})(window);
