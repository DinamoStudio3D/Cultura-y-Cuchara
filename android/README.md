# VisitaLoja para Android

Primera fase: propuesta de interfaz de Inicio y Explorar en `design/index.html`. Es una maqueta interactiva en navegador para revisar el diseño antes de implementar Kotlin/Jetpack Compose; no es una APK, una TWA ni una aplicación WebView.

Identidad: logo oficial, azul #075bb2, fondos claros, fotografías de Loja con crédito a Geovanny Muñoz, navegación inferior. Inicio ofrece fotografía editorial, categorías y tarjetas; Explorar añade búsqueda y filtros. La ficha de demostración muestra información pública del negocio. Favoritos son temporales en memoria y no modifican cuentas. Pasaporte y Mi cuenta están deshabilitados expresamente porque no se han implementado.

Los negocios se consultan en modo lectura desde `locales` del Firebase existente y pasan por la misma política de publicación del buscador web. No se inicia sesión, guarda perfiles, registra suscripciones, otorga sellos ni envía notificaciones. No hay datos ficticios de negocios ni puntuaciones inventadas. Los errores de conexión muestran reintento; los resultados vacíos tienen una acción para limpiar filtros.

No se modifican la portada, administración, reglas ni servicios publicados. La propuesta permanece en la rama `design/android-app-v1`; no fusionar a main como si fuera una app terminada.

Siguiente fase, tras revisar el diseño: crear proyecto Android nativo y conectar lectura real, autenticación y servicios existentes. La interfaz Android deberá mantener objetivos táctiles y tipografía accesibles, manejo de Atrás y estados de carga/sin conexión. El entorno actual tiene Java 17, pero todavía no Android SDK/Gradle configurados. La firma final y la instalación en dispositivo deben comprobarse antes de entregar una APK como terminada.

## Primera base nativa

`native/` contiene el proyecto Android Kotlin/Jetpack Compose. No incluye WebView, TWA ni navegadores embebidos. Lee exclusivamente la colección pública de paradas mediante HTTPS, filtra borradores/desactivadas, permite búsqueda y categorías, abre ficha y mapas del dispositivo y guarda favoritos locales. La fotografía editorial y el logo se reutilizan sin modificar desde los recursos del repositorio durante la compilación.

Una consulta correcta guarda únicamente la proyección pública necesaria para la pantalla. Si falla la red, puede usar una copia de hasta siete días indicando la fecha de la última consulta. Sin una copia válida muestra reintento. No hace escrituras en Firebase, registra cuentas, entrega sellos ni envía notificaciones. Cuenta y pasaporte están deshabilitados y señalados para la siguiente etapa.

Compilación: Java 17, Android SDK plataforma 35 y Gradle 8.11.1. Desde el repositorio: `./android/native/gradlew -p android/native :app:testDebugUnitTest :app:lintDebug :app:assembleDebug`. El flujo `.github/workflows/android-native.yml` compila en GitHub Actions sin credenciales privadas y publica una APK debug como artefacto. Aplicación de pruebas: `com.visitaloja.app.preview`, nombre «VisitaLoja Prueba», versión 0.1.0. La clave debug temporal no es una firma de distribución definitiva. No se ha configurado publicación en Play Store.

Pendiente: comprobar compilación, resultados de las pruebas y lint; después instalar en un dispositivo real y revisar navegación, imágenes, búsqueda, favoritos, orientación, tamaños de texto y recuperación sin conexión. No declarar esas pruebas de dispositivo realizadas sin evidencia. El mapa integrado y los módulos de cuenta/pasaporte no forman parte de esta primera APK.
