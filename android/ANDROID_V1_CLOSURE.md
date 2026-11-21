# Cierre propuesto de Android v1 — base 0.106.0

Estado revisado contra el código de design/android-app-v1. No es un porcentaje de migración ni una certificación de funcionamiento físico.

## Regla de cierre

Congelar funciones y diseño nuevos. La siguiente APK debe responder a un fallo encontrado o a preparación de distribución. Mantener la 0.106.0 como candidata de pruebas hasta que exista un motivo concreto para sustituirla.

## Comprobaciones ya disponibles

- La compilación debug, las pruebas unitarias y lint de la revisión e4fef1455cb3a35b3c12646a9c567d28e518c6e1 terminaron correctamente en Actions 44920489241.
- Reintento de Actions 44920489241: cercanía en segundo plano, logo/marcador y guía/menús/multimedia terminaron correctamente. La revisión conjunta de mapa se detuvo en la comprobación de Inicio; video no encontró su control. Esos dos resultados no se declaran aprobados.
- El paquete de pruebas es com.visitaloja.app.preview; no equivale al paquete definitivo com.visitaloja.app.
- Existe configuración Firebase debug; no existe src/release/res/values/firebase.xml en este checkout. La tarea validateProductionConfiguration impide distribuir release sin configuración y firma válidas.

## Bloqueantes para distribuir Android

1. Terminar revisión de resultados automáticos; reproducir y corregir fallos funcionales, distinguiendo problemas de infraestructura de fallos de la app.
2. Validar en teléfono apertura, navegación, fotos y video vertical, mapa/ubicación, enlaces y menús QR; sin cierres inesperados ni pérdida de sesión.
3. Con cuentas de prueba, validar cliente/encargado: código de visita, límite diario, sellos, premios, historial y sincronización web/app. No usar consumos ni canjes reales como prueba.
4. Validar permisos y notificaciones: FCM con app cerrada; cercanía solo para categorías de comida/cafeterías/restaurantes/bares y afines, excluyendo marcas aliadas; comprobar pantalla apagada y reinicio en teléfono físico.
5. Configurar Firebase para com.visitaloja.app y huellas de distribución; validar Auth/FCM con esa variante, no inferirlo desde debug.
6. Validar firma definitiva, generar AAB y revisar privacidad, declaración de ubicación y enlaces verificados antes de publicar. La firma de pruebas debe seguir separada.

## Alcance recomendado del primer lanzamiento

Experiencia del visitante y operaciones habituales de negocio ya implementadas. La paridad administrativa completa con la web no es un requisito técnico para instalar Android, pero su aplazamiento es una propuesta de alcance y debe ser conocido por el propietario.

Pendientes de migración que requieren cierre posterior si se exige reemplazar toda la administración web: editor avanzado de QR/menús, pagos y recordatorios comerciales, aplicación masiva de servicios, tableros/estadísticas globales, importación masiva de festival, opciones adicionales de editores y cobertura integral ES/EN. Esta lista proviene del inventario acumulado; no es una auditoría campo por campo de toda la web.

La administración web puede seguir atendiendo esas operaciones en la primera versión propuesta. iOS es una entrega distinta y no se considera terminado al cerrar Android.

## Primera sesión de pruebas del propietario

Instalar la 0.106.0 existente y comprobar primero Inicio → categoría → parada → fotos/video → mapa → volver. Registrar pantalla, acción, resultado esperado y resultado observado. Corregir bloqueantes antes de seguir con cuentas/QR/sellos y notificaciones. No añadir funciones por sugerencia durante esta fase.

## Revisión de cierre del 21 de noviembre

La prueba de video podía localizar el TextView del rótulo (40 px) y rechazarlo por no alcanzar el mínimo del botón (50 px). Ahora sube al contenedor pulsable habilitado antes de evaluar límites y tocarlo. Comprobación local con XML sintético: respeta controles deshabilitados y no selecciona rótulos ajenos. Aún debe confirmarse en emulador que resuelve el fallo observado; no se modifica la elegibilidad comercial del video.

La prueba de Inicio medía las categorías con la oferta inicial de notificaciones aún abierta. Ahora pulsa explícitamente Ahora no, comprueba que se oculta y conserva las mismas comprobaciones de categorías, búsqueda y navegación. No concede permisos ni registra suscripciones.

Ambas correcciones afectan a los scripts de prueba, no al código de la APK. Se añade el script de video al filtro de cambios del workflow. La 0.106.0 entregada sigue siendo la candidata de instalación. La repetición automática de estos cambios queda pendiente al registrarlos. El propietario indicó que todavía no instaló la APK; la validación física sigue pendiente.
