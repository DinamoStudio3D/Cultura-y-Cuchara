# Fidelidad V81 — Base visual y preparación de campañas

Base V80 9ce502b. Rama exclusiva design/modernizacion-web-v1.

Esta fase NO acredita un sistema completo de seguidores, avisos ni notificaciones push. Entrega mejoras sobre la cartera real, borradores locales y una política pura probada; el backend de notificaciones todavía no está conectado.

## Auditoría: lo existente

- Cliente: fidelidad.html, ingreso Google, tarjeta de cada programa activo, contadores, premios e historial. El perfil personal está en userProfiles y su formulario en la web principal.
- Negocio: merchant-dashboard.html y confirmar-visitas.html, asignación mediante missionRewardMerchants, clientes/consumos, visitas, entrega/anulación y una oferta de cumpleaños por negocio.
- Administrador: gestion-fidelidad.html administra programas, reglas, asignaciones, clientes y actividad. Su acceso actual admite el correo propietario; no debe confundirse con una autorización completa para todos los adminUsers.
- Firebase: loyaltyPrograms, loyaltyCounters, loyaltyVisits, loyaltyRewardClaims, birthdayOffers y birthdayRedemptions existentes. Las reglas locales no prueban cuáles están desplegadas.
- Cumpleaños actual: una misma oferta válida daysBefore/daysAfter; no hay tres beneficios independientes ni envíos automáticos. La elegibilidad y año de canje se calculan en navegador; se debe revisar el caso diciembre/enero y validar la fecha y canje en backend antes de ampliarlo. No se modificaron canjes existentes.
- No se identificó un sistema de followers, inbox/outbox ni integración push. Una visita o favorito no constituye consentimiento para recibir promociones.

## Implementado en V81

1. Centro de tarjetas con búsqueda, filtros Todas/Con visitas/Por descubrir, más ancho en escritorio y acciones Registrar visita/Ver negocio usando los destinos existentes. Las condiciones del beneficio se muestran desde el campo administrativo existente, sin un editor duplicado.
2. Vista previa de tarjeta conectada a los campos actuales de programa en gestión administrativa. Muestra tres sellos simulados, no guarda y no genera códigos. Logo/identidad del negocio y meta/beneficio vienen de la configuración existente.
3. Estudio de cumpleaños en portal de negocio y administrador. Beneficio/titular y mensaje/condiciones para Antes/El día/Después; ventanas 0–30 días; ejemplos visuales de aviso; guardar/recuperar borrador local separado por UID y parada. No publica birthdayOffers ni manda mensajes. El negocio recibe únicamente las paradas ya cargadas por su portal; no se amplían sus permisos.
4. Política pura reutilizable: calendario America/Guayaquil, tres etapas, año del cumpleaños incluso al cruzar enero, ventanas y textos validados, consentimiento separado para bandeja/push, identificador de entrega por usuario/parada/año/etapa y supresión de identificadores ya entregados. Propuesta para 29 de febrero: 28 de febrero en años no bisiestos. No conectada al canje actual ni a un scheduler.
5. Correcciones: escape correcto de comillas; logos vacíos usan fallback; límites de renderizado de sellos ante números inválidos; respuestas de cartera después de cerrar/cambiar cuenta no muestran datos de la sesión anterior. Se retiraron 6525 caracteres de una copia de código después de </html> en gestión de fidelidad; sus funciones originales dentro del script se conservan.
6. Contraste de acciones y búsqueda corregido frente a estilos globales anteriores. No se alteraron reglas QR, pasaporte, sellos, premios o misiones.

## Próxima implementación propuesta

| Actor | Experiencia |
| --- | --- |
| Cliente | Login existente; perfil privado; seguir/dejar de seguir cada negocio; preferencias independientes para promociones y cumpleaños; bandeja de avisos; permiso push solicitado por acción explícita; silenciar/revocar |
| Negocio | Solo paradas asignadas; configurar tarjeta/beneficio mediante servicio autorizado; campaña general o cumpleaños; borrador y vista previa; audiencia consentida; programación, resultados y cancelación antes del envío |
| Administrador | Todos los programas y campañas; permisos por rol, revisión/aprobación de campañas, límites de frecuencia, pausas, auditoría y estadísticas agregadas |

### Datos propuestos

- loyaltyFollows: UID, placeId, active, consentimiento versionado y preferencias. No compartir perfil completo con el negocio ni tratar como seguidores automáticamente a clientes existentes.
- loyaltyCampaigns: propietario, placeId, tipo, contenido y condiciones, ventanas, estado draft/submitted/published/paused y revisión administrativa. Mantener copia publicada separada del borrador.
- loyaltyInbox: mensajes individuales de cada usuario, fecha y estado leído. El cliente solo puede leer los propios y marcar leído.
- loyaltyNotificationOutbox: trabajo de entrega idempotente por destinatario/campaña/etapa; reintentos, estado reservado/entregado/fallido, auditoría, vencimiento y límites por negocio/cliente.
- loyaltyPushDevices: dispositivos privados del usuario; alta/baja a través de backend autenticado. El negocio no lee tokens. No enviar fecha de nacimiento ni documentos personales en la pantalla de bloqueo.

La propuesta de reglas está en loyalty-notification-rules-proposal.txt; NO está agregada a firestore.rules ni desplegada. Es un borrador para prueba en emulador, no una política certificada. Los helpers de permisos existentes deben reutilizarse y revisar administración por claims/adminUsers activo.

### Servicios a construir y probar antes de activación

1. Seguir/dejar de seguir y registrar preferencias, sin crear sellos o visitas.
2. Servicio autorizado de borrador/publicación de campañas; validar pertenencia de parada en backend, límites, mensajes/enlaces y estado del programa.
3. Selector de destinatarios a partir de consentimientos vigentes; no aceptar listas de UID arbitrarias del dueño. Evitar exponer perfiles y emails completos.
4. Planificador de cumpleaños y promociones: recalcular consentimiento antes de cada entrega, zona horaria fija, ventanas/fecha del cumpleaños validada desde perfil privado y una entrega lógica por etapa/año.
5. Bandeja más envío FCM: reservar entrega de forma atómica, separar resultado en bandeja de resultado push, gestionar errores/tokens inválidos. Push puede entregar más de una vez ante fallos; no prometer exactamente-una-vez del proveedor. Registrar una notificación lógica en bandeja.
6. Canjes de cumpleaños en backend, comprobando elegibilidad y pertenencia, mínimo de consumo y clave única; definir si el negocio concede un beneficio total anual o uno distinto por etapa antes de aplicar cambios a datos existentes.
7. Confirmar configuración Cloud Messaging, credenciales web públicas y compatibilidad del service worker existente en entorno aislado. No crear un segundo service worker que interfiera con la PWA.

Referencias oficiales consultadas: https://firebase.google.com/docs/cloud-messaging/web/get-started y https://firebase.google.com/docs/cloud-messaging/send/admin-sdk . No se configuró ni utilizó FCM.

## Pruebas y límites

- 30/30 tests técnicos (3 nuevos de política), 77/77 tests backend existentes. Sintaxis, validador integral y diff correctos.
- 12 escenarios de navegador: cliente, negocio y administrador en 320/390/768/1440 px. Datos/proveedores aislados; búsqueda/filtros y destinos, preview de tarjeta, borradores por cuenta/parada, mensajes escapados, cero escrituras y cero envíos, respuesta retrasada después de logout descartada. Sin errores JS ni desbordamiento de documento; tablas conservan su desplazamiento interno.
- Capturas escritorio/móvil inspeccionadas. Fotos de repositorio, fuentes/iconos remotos sustituidos o ausentes; no verifican identidad visual de todos los negocios reales.
- Regresión backend acredita conservación de lógica probada localmente, no permisos desplegados ni un canje real.

[Tarjetas móvil](v81/wallet-390.webp) · [Tarjetas escritorio](v81/wallet-1440.webp) · [Campañas móvil](v81/studio-gestion-fidelidad-390.webp) · [Campañas escritorio](v81/studio-gestion-fidelidad-1440.webp) · [Resultados](v81/browser-report.json).

## Revisión del propietario

En fidelidad.html ingresar con la cuenta del cliente y comprobar tarjetas, búsqueda y destinos. No generar/confirmar códigos para esta revisión. En gestion-fidelidad.html abrir el programa existente, cambiar la meta/beneficio solo en formulario para ver la tarjeta, sin Guardar programa. En el portal administrativo o del negocio abrir Campañas · Preparación local, seleccionar parada y guardar/recuperar borrador. No modifica beneficios publicados. El acceso real conserva los registros/operaciones existentes de cada portal; pruebas automáticas no usaron cuentas reales.

Pendiente: nueva bandeja, seguidores reales, preferencias persistidas, promociones generales, programación/envíos push, autorización avanzada, pruebas de reglas/servicios y canje ampliado. La activación requerirá revisión del código/reglas, pruebas aisladas y autorización de los cambios a infraestructura/datos reales. No se ha iniciado una migración.
