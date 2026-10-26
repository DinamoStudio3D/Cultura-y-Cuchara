# Prueba privada de notificaciones

Pantalla: `/push-test.html`. No está enlazada en la navegación pública ni envía campañas. Solo administración puede obtener la configuración o solicitar un envío. El mensaje y su destino son fijos. El token se mantiene en memoria del navegador y no se registra en Firestore. Se guardan únicamente límites de prueba por UID (un intento por minuto y veinte por día UTC), antes de contactar con FCM; los intentos fallidos también consumen el límite.

## Preparación del despliegue de preview

1. Reutilizar el proyecto Firebase `cultura-y-cuchara` y su credencial de servidor ya usada por `api/_firebase-admin.js`. La variable `FIREBASE_SERVICE_ACCOUNT_JSON` debe estar disponible en Preview. No copiar claves en Git ni en el chat.
2. Firebase → Configuración del proyecto → Cloud Messaging → Configuración web → Certificados de Web Push. Obtener la clave **pública** del par existente, o generar un par si no existe. No usar ni compartir la clave privada.
3. Configurar `FCM_WEB_VAPID_PUBLIC_KEY` con esa clave pública en Vercel, entorno Preview, preferentemente restringida a `feature/push-test`. Volver a desplegar esa rama. Cloud Messaging API y FCM Registration API deben estar habilitadas para el proyecto.
4. Firebase Authentication → Dominios autorizados: autorizar el dominio exacto de la preview si el acceso con Google lo requiere.

## Prueba real pendiente

Abrir la pantalla en el dispositivo, entrar como administrador, activar el dispositivo y conceder permiso. Pulsar «Enviarme una prueba». Con la pantalla activa, se muestra el mensaje recibido; con otra aplicación abierta, debe aparecer la notificación del sistema. La respuesta `accepted` solo significa aceptación por FCM, no recepción confirmada. Pulsar el aviso vuelve a esta pantalla del mismo origen. Desactivar elimina el token de FCM de ese navegador; el permiso del navegador se cambia en sus ajustes.

El worker de prueba se registra con alcance `/push-test/`, separado del worker PWA existente. No se modifican ni reemplazan `service-worker.js`, Cloudflare, reglas ni usuarios. iOS/iPadOS requieren 16.4+ y abrir la web instalada en la pantalla de inicio. El modo privado, permisos bloqueados o restricciones del sistema pueden impedir recibir avisos.

Esta fase no incluye destinatarios generales, seguidores, promociones, programación ni integración en admin. Esos controles se incorporarán después de confirmar la entrega real. No fusionar a main sin aprobación.

# Centro de avisos generales

La nueva fase añade `notifications.html` para suscripción voluntaria por cuenta y dispositivo, y el módulo **Notificaciones a usuarios** en `admin.html`, que carga `admin-notifications.html`. Mantiene `push-test.html` para la prueba inicial ya confirmada por el propietario.

`/api/notifications` reutiliza `api/chabaquito-ranking.js` y delega en `functions/push-campaigns.js`; no añade otra función de Vercel. La credencial Firebase y la clave pública permanecen limitadas a `feature/push-test` en Preview. No es necesario modificar Cloudflare ni publicar reglas: las nuevas colecciones quedan protegidas por la denegación final de `firestore.rules`, y solo el servidor usa Admin SDK.

Cada origen tiene su propio árbol `pushScopes/{sha256(origin)}`. `devices` guarda token, UID y consentimiento explícito versión 1. Las bajas eliminan el token, conservando un identificador no secreto y el estado del consentimiento. El navegador guarda únicamente ese identificador con el UID para permitir dar de baja el dispositivo incluso si se revocó el permiso en el sistema. Cada nueva aceptación después de una baja genera una revisión distinta del consentimiento. Los tokens no aparecen en respuestas de administración, historial ni logs.

Preparar un aviso congela título (80 caracteres), mensaje (240), ruta pública permitida y público (hasta 400 dispositivos). Es idempotente por identificador, inmutable y está limitado a tres avisos nuevos al día por administrador. No importa seguidores internos ni el dispositivo de la antigua prueba automáticamente. Primero hay que activar una suscripción general desde `notifications.html`; el panel ofrece ese enlace para iniciar sin destinatarios.

Antes de enviar se exige una prueba aceptada por FCM en las últimas 24 horas y confirmación del administrador de que la recibió, además de confirmar el número de dispositivos. Las pruebas se limitan a 20 al día, una por minuto, con diez segundos para cambiar de aplicación. Cada envío manual procesa hasta 25 pendientes; desde el historial se puede revisar y continuar. No hay cron, campaña automática ni reintentos silenciosos. Antes de cada intento se verifica nuevamente la suscripción, la cuenta y la revisión del consentimiento. Un dispositivo que se dio de baja y volvió a suscribirse no revive el público de un aviso viejo.

Los intentos reclamados se registran antes de contactar FCM. Los intentos ambiguos o interrumpidos no se reenvían automáticamente. El historial distingue aceptados por Firebase, fallidos, omitidos, pendientes y sin confirmación; no mide lectura ni garantiza entrega. Los tokens no registrados se desactivan. Un identificador de aviso en el `tag` evita sustituir anuncios diferentes en el sistema. El clic abre una ruta del mismo origen; no se admiten destinos externos o administrativos.

Pruebas automatizadas: consentimiento y propiedad, autorización, aislamiento entre orígenes, URL permitida, público inmutable, idempotencia, confirmación y prueba previa, límites, bajas, nueva aceptación, concurrencia, tokens inválidos, errores ambiguos, paginación y fallos de persistencia. Fixtures visuales generadas con `node scripts/build-notification-review.cjs` usan datos ficticios y bloquean toda comunicación real.

Pendiente en dispositivo real: nueva suscripción general, prueba con contenido personalizado, un envío al grupo de prueba y baja. La recepción de la antigua prueba fija ya fue confirmada por el usuario; no sustituye estas comprobaciones. No fusionar a main sin autorización. Antes de una futura publicación deberán configurarse explícitamente las variables en producción; las de esta rama no pasan a producción al fusionar.
