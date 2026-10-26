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
