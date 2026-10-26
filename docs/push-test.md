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
