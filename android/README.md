# VisitaLoja para Android

Primera fase: propuesta de interfaz de Inicio y Explorar en `design/index.html`. Es una maqueta interactiva en navegador para revisar el diseño antes de implementar Kotlin/Jetpack Compose; no es una APK, una TWA ni una aplicación WebView.

Identidad: logo oficial, azul #075bb2, fondos claros, fotografías de Loja con crédito a Geovanny Muñoz, navegación inferior. Inicio ofrece fotografía editorial, categorías y tarjetas; Explorar añade búsqueda y filtros. La ficha de demostración muestra información pública del negocio. Favoritos son temporales en memoria y no modifican cuentas. Pasaporte y Mi cuenta están deshabilitados expresamente porque no se han implementado.

Los negocios se consultan en modo lectura desde `locales` del Firebase existente y pasan por la misma política de publicación del buscador web. No se inicia sesión, guarda perfiles, registra suscripciones, otorga sellos ni envía notificaciones. No hay datos ficticios de negocios ni puntuaciones inventadas. Los errores de conexión muestran reintento; los resultados vacíos tienen una acción para limpiar filtros.

No se modifican la portada, administración, reglas ni servicios publicados. La propuesta permanece en la rama `design/android-app-v1`; no fusionar a main como si fuera una app terminada.

Siguiente fase, tras revisar el diseño: crear proyecto Android nativo y conectar lectura real, autenticación y servicios existentes. La interfaz Android deberá mantener objetivos táctiles y tipografía accesibles, manejo de Atrás y estados de carga/sin conexión. El entorno actual tiene Java 17, pero todavía no Android SDK/Gradle configurados. La firma final y la instalación en dispositivo deben comprobarse antes de entregar una APK como terminada.
