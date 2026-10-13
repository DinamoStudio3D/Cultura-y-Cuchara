# V88 — servicio preparado de avisos internos

## Estado y autorización

Código preparado, sin desplegar Functions ni reglas, sin activar flags y sin enviar avisos reales. La Preview solo incorpora pantallas. La entrega del servicio usa `settings/loyaltyNotificationsV88.enabled === true`, además del flag de seguidores V83. Ninguno se crea automáticamente. No existe scheduler ni envío push.

Cada negocio tiene `loyaltyNotificationPrograms/{placeId}` con enabled, ownerCanPublish, maxDailyDeliveries (1–500) y batchSize (1–50, no superior al límite diario). Solo el administrador configura estos controles. Publicar o entregar exige autorización actual del negocio en la transacción y permiso ownerCanPublish para propietarios. Las pausas siguen permitidas a gestores asignados cuando el servicio global está detenido.

## Promociones y entrega

Callables preparados: configureLoyaltyNotifications, saveLoyaltyPromotion, publishLoyaltyPromotion, pauseLoyaltyPromotion, dispatchLoyaltyPromotionBatch, getLoyaltyPromotionOverview, getLoyaltyNotificationInbox y markLoyaltyNotificationRead.

Los borradores del servicio exigen fechas de inicio/fin en hora de Ecuador y una ventana de hasta 30 días. Los controles de versión evitan sobrescribir cambios ajenos. Publicar no envía avisos. Una promoción publicada es inmutable; para cambiar su contenido hay que crear otra. Pausar impide nuevos avisos y no elimina el historial.

La entrega manual por lotes selecciona únicamente documentos loyaltyFollows del mismo negocio con active=true, promotions=true y consentVersion=1. No acepta una lista de destinatarios del cliente. Relee la configuración, campaña, permisos, seguidores y cuota en la misma transacción que crea los avisos. El ID por campaña/usuario impide duplicados en reintentos. La cuota diaria por negocio usa el calendario de Ecuador y suma entregas de todas sus campañas. Un lote que supera la cuota se rechaza íntegro; se puede reintentar otro día mientras la promoción siga vigente.

La paginación devuelve solo nextCursor y cantidades, sin identidades de visitantes. No es una audiencia congelada: usuarios que siguen el negocio después de pasar su posición pueden requerir una nueva pasada desde cursor nulo. No hay automatización que complete esas pasadas.

Cada visitante tiene una subcolección privada `loyaltyNotificationUsers/{uid}/inbox`. Los avisos incluyen una copia del mensaje, condiciones y negocio al entregarse. Se consultan los últimos 50 por createdAt; marcar leído es idempotente y usa siempre el UID autenticado. No hay paginación de bandeja ni limpieza histórica todavía. El historial permanece tras dejar de seguir.

## Pantallas

Administración: consulta explícita del servicio, controles administrativos y pausa de promociones publicadas. Propietario: consulta del negocio y pausa. Visitante: consulta de bandeja y marcar leído. Abrir las páginas no hace llamadas nuevas al servicio. Sesiones o respuestas anteriores se descartan. Los borradores locales V87 no se suben automáticamente: el flujo visual de guardar/publicar/entregar una promoción en el servicio sigue pendiente.

## Validación y despliegue pendiente

Pruebas con DB/DOM simulados: consentimiento, empresas independientes, permisos retirados, ventanas, pausa, cuota a medianoche de Ecuador, concurrencia serializada, reintentos, rollback, contenido seguro, bandejas privadas y sesiones cambiantes. No equivalen a emuladores, pruebas de concurrencia de Firestore real ni revisión visual.

Antes de habilitar en un Firebase aislado se necesita verificar un índice compuesto para loyaltyFollows: placeId ASC, active ASC, promotions ASC, consentVersion ASC y orden por documento ASC; verificar el índice del overview por placeId y el orden simple createdAt de cada inbox. No se añadió un archivo de índices que pudiera reemplazar índices de producción. Las reglas actuales deniegan acceso directo a las colecciones nuevas; solo las Functions mediante Admin SDK las utilizan. No se requiere abrir esas colecciones al navegador.

Pendiente: despliegue e integración en entorno aislado con autorización, flujo visual de publicación/entrega con revisión final, puente de cumpleaños de tres fases, notificaciones push, rate limiting adicional y comprobación de App Check antes de habilitar. Las callables mantienen enforceAppCheck=false conforme a las existentes; la activación real requiere revisar esa elección.
