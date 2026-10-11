# V89 — flujo visual de promociones del servicio

Los borradores locales V87 incorporan Llevar al servicio. Esto copia el borrador guardado al apartado de revisión de avisos del mismo negocio y cuenta, sin llamadas ni publicación. Se exigen inicio y fin y una ventana máxima de 30 días para este paso; los borradores locales sin fechas siguen permitidos.

Después de consultar el servicio, Guardar borrador envía el ID local como campaignId y la revisión conocida del servidor. No crea otro ID en cada reintento. Una promoción ya publicada no se puede sobrescribir. Publicar tiene una revisión separada con negocio, título, mensaje, condiciones y fechas; el usuario debe confirmar expresamente. Publicar no entrega avisos.

La entrega se inicia desde una promoción publicada, vigente y autorizada. Cada clic, tras confirmación con el título y límite del lote, hace una sola petición. No hay loops, scheduler ni entregas al abrir la página. El cursor se conserva en memoria por campaña hasta cambiar cuenta o negocio; solo avanza tras una respuesta confirmada. Terminar una pasada permite iniciar otra para nuevos seguidores. Recargar la página reinicia el cursor: los IDs del servidor evitan duplicados.

La consulta del servidor ahora devuelve también disponibilidad del seguimiento y publicación de la parada. Los controles visuales respetan esos flags, permisos del propietario y ventana de fechas; el servidor vuelve a comprobarlos en cada operación. Los permisos administrativos permanecen dentro del módulo existente.

Los errores de red en operaciones de escritura indican que el resultado no se pudo confirmar. No se afirma que no haya habido una publicación o entrega. Se pide consultar el estado y se conserva el cursor para reintentar sin repetir avisos existentes. El público de un lote puede cambiar con altas/bajas de seguidores; el reintento repite el cursor, no una lista de destinatarios congelada.

Pruebas con DB/DOM simulados: copia de borrador sin publicación, revisiones, revisión y confirmación explícita, permisos, pausa del seguimiento, un lote por clic, cursor tras error y respuestas de una selección anterior. Sin QA visual ni emuladores.

Estado: código y pantallas preparados, sin desplegar Firebase ni activar flags, sin enviar avisos reales ni modificar producción. Siguen pendientes prueba integral en Firebase aislado, puente de cumpleaños de tres momentos, push, validación visual y revisión de índices/App Check antes de la activación. V88 documenta las colecciones y callables.

## Corrección solicitada: Cantones de Loja

El menú Descubrir de escritorio y móvil ahora enlaza a #cantones. Se retiró el salto incorrecto a #categorias. El directorio reutiliza los 16 cantones del catálogo administrativo, permite búsqueda sin distinguir tildes y muestra los lugares publicados con cantonId asignado exactamente. Cada ficha enlaza a la URL pública existente del lugar. Los cantones sin paradas muestran un estado explícito. No se infiere el cantón por dirección ni se publican negocios en borrador u ocultos. La actualización pública de locales actualiza también el directorio. Las asignaciones se configuran en Paradas y negocios; no se crearon datos reales ni otro panel paralelo.
