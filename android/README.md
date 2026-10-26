# VisitaLoja para Android

La app nativa Kotlin/Jetpack Compose está en `native/`; la propuesta visual anterior, en `design/`. La propuesta del navegador no reproduce automáticamente las nuevas funciones nativas. La rama de trabajo es `design/android-app-v1` y no debe fusionarse sin autorización.

## Versión 0.2.0 de pruebas

Inicio y Explorar leen las paradas públicas reales, filtran borradores y ofrecen búsqueda, categorías, ficha y apertura en mapas del dispositivo. Solo el directorio público se guarda en disco (hasta siete días, fecha visible).

Mi cuenta usa Firebase Authentication del mismo proyecto `cultura-y-cuchara`, con Google mediante Credential Manager o correo/contraseña existente y recuperación de contraseña. El UID es el mismo que en la web. La configuración pública Android recibida del propietario se transforma en recursos de `app/src/debug/res/values/firebase.xml`, equivalentes a los generados por Google Services. No contiene una cuenta de servicio, clave administrativa ni permisos privilegiados. Solo está registrada la variante `com.visitaloja.app.preview`; antes de preparar release hay que registrar también su paquete definitivo.

Al ingresar se consulta `userProfiles/{uid}` sin modificar perfiles. Los favoritos autenticados usan `userProgress/{uid}` de la web. Una transacción cambia únicamente favorites y updatedAt, conserva agenda, festivales, itinerario y modo de pasaporte, y cumple el límite de 150 favoritos. Al faltar el documento se crea el esquema admitido por las reglas actuales. No se guardan cambios offline ni se presenta una operación fallida como guardada. Los favoritos de invitado permanecen locales y solo se añaden a la cuenta tras una confirmación explícita. Cambiar/cerrar sesión retira listeners y datos privados de la UI; la caché de Firestore permanece en memoria y no se escribe en disco.

Pasaporte, tarjetas, sellos, recompensas, edición de perfil y notificaciones nativas siguen pendientes. El acceso no otorga roles de negocio/admin, no añade sellos ni cambia reglas, Workers ni la web publicada. Google puede crear una identidad de Firebase con el consentimiento habitual del usuario; no se crea automáticamente un perfil completo ni se combinan cuentas.

## Compilación y entrega

Java 17, SDK Android 35 y Gradle 8.11.1. Ejecutar desde el repositorio:

```sh
./android/native/gradlew -p android/native :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

El flujo `.github/workflows/android-native.yml` genera una APK debug y los informes de pruebas/lint. La APK de CI lleva una firma temporal por ejecución: **no entregarla como actualización estable ni registrar esa firma para Google**. La entrega 0.2.0 se vuelve a firmar fuera del repositorio con la clave privada estable de pruebas, respaldada como `VisitaLoja-firma-privada-pruebas.zip`. Recuperar el mismo respaldo para posteriores entregas de este paquete; nunca generar otra clave por comodidad ni incluir el respaldo en git/artefactos públicos. No es la firma final de Play Store. La primera transición desde 0.1.0 requiere reinstalar la app de pruebas por cambio de firma; los favoritos locales de 0.1.0 no se migran al desinstalar.

La huella SHA-1 de la firma estable debe añadirse a esta app Android en Firebase para autorizar Google. Después se comprueba el acceso real en dispositivo, cambio de cuenta/cierre de sesión y sincronización de favoritos en ambas direcciones. Compilación y pruebas automáticas no sustituyen esas pruebas. No declarar el acceso Google probado antes de configurar la huella y ejecutar el flujo real.

## Versión 0.3.0: consulta de pasaporte y tarjetas

Pasaporte habilita las vistas turista/lojano y Mis tarjetas. Consulta `siteContent/passport`, `securePassportStamps`, `loyaltyCounters`, `loyaltyPrograms`, `loyaltyRewardClaims` y `passportCompletions` del mismo proyecto; las consultas privadas llevan el filtro userId del usuario autenticado. Los listeners solo están activos mientras se ve Pasaporte. Cambiar/cerrar sesión retira los listeners y la UI rechaza estados cuyo UID no coincide con la cuenta actual. No hay escrituras nuevas en este módulo.

El pasaporte deduplica por parada y campaña y reproduce las categorías de la web: turista 1 hotel + 5 gastronomía; lojano 6 gastronomía. La selección de vista no cambia el modo de la cuenta. Las tarjetas muestran política habitual preservada, temporada activa y temporadas anteriores; al acabar la temporada reaparece la habitual. Se distingue una recompensa registrada de completar un ciclo y nunca se generan códigos ficticios. Las recompensas de fidelidad vencidas, entregadas o sin vigencia comprobable no muestran un código de canje utilizable. Sin confirmación del servidor se ocultan códigos.

La generación de códigos de visita y la solicitud de nuevas recompensas permanecen en la web y se indican expresamente en pantalla. Esta APK añade consulta nativa, no sustituye todavía esos flujos. Se mantiene la firma estable de pruebas del respaldo privado 0.2.0 para poder actualizar sin desinstalar ni cambiar la huella de Google. Pendiente comprobar en dispositivo los datos reales con la misma cuenta.

## Versión 0.4.0: fondo de marca

Todas las pantallas comparten un fondo azul claro con una transición cálida suave y el logo oficial como marca de agua decorativa al 6,5 % de opacidad. No captura gestos ni añade texto a accesibilidad. La cabecera y la navegación toman el mismo azul claro; buscadores y tarjetas conservan superficies claras para proteger la lectura. Se reutiliza el recurso oficial ya incluido, sin descargas o permisos nuevos. No cambia la autenticación, los datos ni las reglas de pasaporte/fidelidad.

La misma versión 0.4.0 amplía las fichas: galería publicada con visor completo y navegación por deslizamiento/flechas, contacto por WhatsApp y marcador telefónico cuando el negocio publica esos números, y compartir la URL canónica de su parada. No inicia llamadas ni envía mensajes automáticamente. Los contactos provienen exclusivamente de businessProfile público; URLs HTTPS y números se validan antes de mostrarlos. La caché mantiene solo esta proyección pública. Las fotos verticales se muestran completas dentro del visor.

## Versión 0.5.0: agenda nativa

Inicio incorpora Qué está pasando y acceso a la agenda completa. Los eventos se consultan del documento público `siteContent/events`, sin datos de muestra. Respeta publicación/ocultamiento, fecha y hora de Loja; la visibilidad termina una hora después del inicio, igual que la cartelera web. Permite búsqueda sin acentos y filtros Próximos, Hoy y 7 días, ficha con afiche completo, ubicación externa y compartir información. No añade calendario, reservas, permisos o escrituras en Firebase. Datos sin confirmación del servidor se indican; no se inventan eventos cuando la agenda está vacía. El detalle abierto se retira si el evento se oculta o termina su ventana de visibilidad. Mantiene la firma estable de pruebas. Pendiente comparar la programación real con la web en dispositivo.
