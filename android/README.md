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

## Versión 0.6.0: cantones nativos

Inicio abre el catálogo de los 16 cantones del mismo catálogo web. Cada guía consulta `siteContent/canton_<id>` y muestra contenidos publicados: portada/crédito, presentación, destacados e información editorial. No inventa fotografías ni guías vacías. Si no existe portada usa una foto de una parada publicada del mismo cantón, o un icono decorativo identificado como tal. Los lugares se filtran por asignación exacta de cantón, con compatibilidad de registros antiguos sin asignación exclusivamente para Loja. Borradores, inactivos y moteles se excluyen igual que en la guía web. Búsqueda/categorías y orden de paradas destacadas no pueden introducir paradas de otro cantón. Ficha de negocio, ubicación del cantón y compartir enlazan a contenidos reales. El listener de guías solo está activo al ver cantones y se conserva al pasar del listado a una guía. El regreso de Android vuelve primero al catálogo. No se modificó la preview web a petición del usuario; no hay cambios de producción. Mantiene la firma estable para actualizar la APK.

## Versión 0.7.0: flujo nativo de fidelidad y pasaporte

La ficha y las tarjetas generan códigos de visita con QR VISITALOJA:<6 dígitos>, plazo de nueve minutos y recuperación de solicitudes existentes del mismo usuario/parada. Antes de generar se consultan contadores y códigos del servidor; el límite diario muestra Regresa mañana. La creación utiliza REST commit atómico con Firebase ID token, precondición exists:false y createdAt REQUEST_TIME: no encola escrituras offline ni puede sobrescribir códigos existentes. Se conserva localmente solo la referencia por UID/parada antes de enviar; tras una respuesta incierta se consulta el servidor para recuperar el mismo código. La confirmación/rechazo solo se muestra tras un snapshot del servidor y la app no escribe contadores, sellos ni premios. El encargado y el backend actuales mantienen la autoridad.

Mi cuenta permite crear/editar el perfil bajo las reglas actuales y consentimiento explícito; conserva createdAt y consentAt existentes mediante transacción. Validación de nombre, celular ecuatoriano, ciudad, modo, nacimiento y documento; perfil/documento permanecen en memoria privada y nunca en la caché pública.

El pasaporte permite elegir una opción activa y confirmar una única solicitud a /api/chabaquito-ranking?action=passport-claim con Bearer Firebase. El endpoint existente valida visitas, perfil, campaña y disponibilidad, conserva reclamaciones previas y devuelve el mismo código ante reintentos. Recompensas de fidelidad ya registradas por el negocio y recompensas del pasaporte se muestran con QR para validación del encargado; caducadas/entregadas/sin confirmación del servidor se ocultan. No existe marcación ni entrega automática desde el cliente. Se reemplazan los accesos obligatorios a la web para estos flujos de cliente.

Pruebas: políticas y codificación/lectura QR JVM; el emulador Firestore recibe el mismo formato REST con transform y valida creación pendiente, protección de sobrescritura y rechazos de usuarios ajenos/confirmaciones/sellos/premios falsificados. No se ejecutan escrituras de prueba contra producción ni se añaden credenciales privilegiadas. Pendiente prueba real con cliente y encargado: generar, escanear/confirmar, comprobar límite diario, sincronización, canje y cambio de cuenta. No declarar esas pruebas reales hechas sin evidencia. La UI de negocios/administración sigue en sus paneles existentes. Firma estable de pruebas.


## Versión 0.8.0: mapa interactivo nativo

Mapa es una pestaña principal, con acceso destacado desde Inicio y alternancia Lista/Mapa en Explorar. Usa MapLibre Native OpenGL ES 12.0.1 y el estilo Liberty de OpenFreeMap, sin API key ni nuevo proyecto Firebase. La atribución del proveedor permanece visible. La cartografía requiere conexión; no se ofrecen descargas offline ni navegación giro a giro.

Los marcadores usan exclusivamente paradas publicadas y coordenadas válidas de la misma proyección pública del directorio; no se geocodifican direcciones ni se inventan coordenadas. Búsqueda, categoría y favoritos filtran antes de generar GeoJSON; los borradores y registros sin ubicación no entran al mapa. Se agrupan marcadores próximos y se amplían al tocar el grupo; marcadores coincidentes ofrecen selección entre las fichas. Cada parada abre la ficha nativa, permite favoritos y entrega Cómo llegar a una app de mapas del dispositivo. Los filtros se conservan al alternar con Lista.

Mi ubicación solicita únicamente permiso de ubicación aproximada al pulsar el control, realiza una consulta puntual de ubicación de red y se cancela al abandonar el primer plano o cerrar el mapa. No almacena coordenadas del usuario, no las escribe en Firebase, no solicita ubicación en segundo plano y no condiciona el uso del mapa al permiso. El punto de ubicación se representa en una fuente local separada de las paradas. Incluye límite de espera, mensajes de falta de permiso/proveedor/señal y cancelación de respuestas antiguas.

El MapView reenvía inicio/reanudación/pausa/parada/destrucción y baja memoria. Incluye recarga con error/espera y acceso a la lista cuando no carga la cartografía. Pruebas de política cubren coordenadas, orden GeoJSON, publicación, filtros, favoritos, deduplicación y separación de ubicación del usuario. Pendiente comprobación real de gestos, marcadores, agrupación, rotación y ubicación aproximada en dispositivo. La APK entregada debe firmarse con el mismo respaldo privado de pruebas de 0.2–0.7; nunca distribuir la firma temporal de CI como actualización.


## Versión 0.8.1: identidad y legibilidad del mapa

La cartografía base cambia a OpenStreetMap Carto, igual que la web. Se conserva la atribución textual visible y enlace de licencia. El cliente HTTP se identifica como VisitaLoja, respeta caché/validadores HTTP y desactiva prefetch; no ofrece paquetes offline. Se conserva MapLibre como renderizador nativo.

Los marcadores recuperan el lenguaje visual web: círculos oscuros con borde de color por grupo, iconos Font Awesome Free locales y logos publicados cuando la configuración lo permite. La fuente se incluye con su licencia. La imagen de portada no se usa como logo. La proyección pública incluye exclusivamente configuración visual necesaria (logo, icono, modo y vigencia del beneficio), compatible con cachés antiguas. El logo puede reemplazar el modo icono solo con beneficio vigente, igual que la web.

La escala de bitmap se fija explícitamente a 3x para conservar una cara de 48 dp en pantallas de alta densidad. Se añaden nombres con halo blanco y se limita la agrupación a zooms lejanos. Al abrir permanece en Loja a escala de calles; consultar todas las paradas deja de alejar automáticamente la cámara a toda la provincia. Búsqueda encuadra coincidencias; los controles permiten ver todas o volver a Loja. Logos visibles se cargan con cuatro descargas concurrentes y fallback a icono, sin bloquear el mapa; se cancelan al destruir la vista. Cambio de URL produce otra clave de sprite para evitar logos antiguos.

Verificar en dispositivo la legibilidad, logos de Expreso al Sur/Codeproim según configuración, nombres, agrupaciones lejanas y solapamientos. Las pruebas automáticas no sustituyen esa revisión visual.


## Versión 0.8.2: ubicación móvil y revisión del mapa

Se reemplaza la consulta puntual de red por ubicación en primer plano: solicitud conjunta FINE/COARSE, Fused Location Provider de alta precisión cuando el usuario concede precisa y fallback de GPS/red del dispositivo (también cuando faltan Google Play Services o falla el proveedor). Sigue funcionando con permiso aproximado sin exigir precisa. La captura se inicia solo con Mi ubicación, se pausa al perder primer plano y se cancela al cerrar mapa; no añade permiso en segundo plano, servicio, historial ni escritura de coordenadas en Firebase. Los callbacks viejos/registro asíncrono tras cancelación se retiran por generación.

La política valida coordenadas, precisión y antigüedad mediante reloj monotónico; oculta señales de más de 30 s y evita saltar desde un GPS reciente bueno a una señal de red peor. La UI distingue señal actual, aproximada, falta de permiso, GPS desactivado y espera sin señal, permite mejorar precisión/abrir ajustes/reintentar/detener. El área azul es un polígono geodésico con radio igual a la precisión en metros; no un círculo decorativo fijo. La cámara sigue únicamente si el usuario lo solicita, deja de seguir al explorar y se recentra con el botón. Las actualizaciones mantienen el zoom elegido.

La cámara se conserva entre rotaciones en un ViewModel de memoria, sin guardar ubicación en disco o cuenta. La búsqueda y favoritos ya no reencuadran por cada actualización del directorio. Seleccionar una parada deja el seguimiento y centra esa parada cuando aparece su tarjeta. Se prioriza el marcador más próximo al punto tocado y se ajusta el padding al tamaño real de la vista para evitar fallos en mapas bajos. Fallos parciales de cartografía muestran aviso compacto; se permite seguir usando el mapa. Los logos fallidos tienen hasta tres intentos con espera y conservan el icono de respaldo.

Validación pendiente de hardware: GPS real en exterior/interior, precisión Android concedida/denegada, ajustes desactivados, movimiento, rotación y pausa/reanudación. Las pruebas unitarias verifican política de señales, orden/calidad, metros del área y encuadre reducido; no simulan una recepción real de satélites.


## Versión 0.8.3: mapa amplio y GPS accesible

La captura de un móvil de 360×800 dp mostró una regresión de espacio: cabecera, título, filtros y panel GPS consumían casi toda la vista, y el control de ubicación quedaba fuera de la columna visible. Mapa ahora omite la cabecera grande y usa cartografía a tamaño completo dentro de la navegación, con búsqueda flotante de marca. Los filtros y detalles GPS son hojas bajo petición; el estado GPS es una píldora compacta, sin instrucciones permanentes. Mi ubicación es un control independiente siempre visible. La tarjeta de parada flota sin reducir la altura del mapa, con variante compacta horizontal. Se fija el contraste de los iconos de sistema sobre el tema claro.

El seguimiento se pausa al arrastrar con un dedo o seleccionar una parada, pero hacer zoom no lo desactiva. Se conserva el GPS de 0.8.2: precisión reportada, filtros temporales y actualizaciones solo en primer plano. La captura reportaba ±4 m; ese dato informa lo que estimó el dispositivo, no demuestra su exactitud física.

Se añade un trabajo de emulador Android 15 con la APK real, a 720×1600 px y densidad 320 (360×800 dp). `scripts/test-android-map-layout.py` verifica área de mapa, accesibilidad geométrica de Mi ubicación, altura del indicador GPS, recenter/zoom/arrastre, desactivación/activación de ubicación, rotación y texto grande; guarda capturas para inspección. Usa ubicación simulada en un emulador desechable y el mapa público de invitado, sin cuentas ni escrituras de datos. No sustituye una prueba de recepción real de satélites en el móvil.


## Versión 0.9.0: imágenes, Loja en el Tiempo y podcast

Inicio incorpora accesos nativos a tres secciones públicas del panel existente. La galería lee `settings/main.photoManagerItems`, respeta `photoManagerInitialized`, sección, visibilidad y créditos; utiliza la misma lista canónica de fotos de la web únicamente cuando el administrador nunca inicializó la galería. Una galería configurada vacía permanece vacía. Ofrece búsqueda por foto/autor, filtros de sección, imagen completa con zoom y desplazamiento, controles anterior/siguiente y compartir enlace web.

Loja en el Tiempo consulta `loja_tiempo`, permite buscar, comparar ayer/hoy mediante un deslizador, abrir cada original completo y leer el relato. Solo reproduce narraciones cuando el panel publica `audioUrl`; no inventa audio ni sustituye una fotografía antigua ausente por una actual. Podcast consulta `siteContent/podcast`; ocultarlo lo retira. El documento ausente usa la misma canción de muestra de la web, pero una URL configurada inválida nunca se reemplaza silenciosamente por otra grabación.

Un único reproductor Media3 en primer plano ofrece pausa, reintento, avance y cierre. Gestiona foco de audio y desconexión de auriculares; se pausa al salir de la app o entrar al mapa, sin servicio ni reproducción de fondo. Una retirada o reemplazo confirmado desde el panel detiene el audio activo. No se modifican reglas, datos de usuario ni paneles de administración. Pruebas de política cubren publicación, créditos, vaciado explícito, URLs, búsqueda y recursos ausentes; el emulador recorre las tres pantallas con contenido público y revisa pausa al ir a segundo plano si hay audio publicado. Pendiente revisión de sonido, auriculares y llamadas en dispositivo físico.

## Versión 0.10.0: Loja en video

Se incorpora la galería nativa de `settings/videoGallery`: activación explícita, hasta 30 registros, publicación individual, orden, títulos, descripciones, créditos, miniaturas y búsqueda por lugar/autor. Los vacíos y retiradas del panel no se reemplazan por videos inventados. Se llega desde Inicio. Se conserva el panel web como única administración.

YouTube se reproduce mediante su IFrame Player oficial dentro de un WebView del sistema, limitado al visor de video. El resto de la app sigue siendo nativo. No se extraen streams, no se descargan videos, no se pide API key ni se crea almacenamiento. El Referer identifica el paquete Android instalado mediante `loadDataWithBaseURL`, conforme a la documentación de YouTube para distribución alternativa. El HTML solo interpola ID validado, origen de la app y segundo inicial; no inserta textos del panel ni expone interfaces JavaScript nativas. Se bloquean acceso a archivos/contenido local, tráfico HTTP, ventanas automáticas y navegación arbitraria. Se conservan controles y marca de YouTube, pantalla completa sin elementos superpuestos y mensajes de restricciones del autor. Los enlaces externos se abren por acción explícita del usuario.

La reproducción requiere un toque en los controles oficiales, pausa el podcast al abrir y se pausa en segundo plano o al desconectar auriculares. El visor se destruye al cerrarse o retirarse/cambiar la publicación. No hay servicio de fondo. Los MP4/WebM ya publicados en el panel conservan reproducción Media3 con controles nativos; no se añade ninguna subida de archivos. Pruebas de política verifican formatos, publicación, URLs, créditos, orden y aislamiento del visor; el emulador recorre el catálogo publicado y registra por separado si YouTube permitió reproducir realmente. No declarar reproducción YouTube verificada si el proveedor la bloquea o no hay videos publicados. Pendiente prueba física de pantalla completa, sonido y red móvil.

## Versión 0.11.0: aventuras de Chabaquito

Inicio incorpora acceso a Retos, Mi aventura y Ranking. El catálogo nativo consulta solo `chabaquitoMissions` con status active, valida metas de 1–500, tipos, fechas y criterios, y presenta vigencia, búsqueda y filtros de disponibles/próximas/completadas/todas. Cada reto detalla su insignia, condiciones y paradas publicadas relacionadas; abrir una parada conserva el registro nativo de visita existente. Los requisitos por categoría/cantón se calculan con valores declarados del documento original, sin usar el cantón Loja que el directorio adopta como valor visual por defecto. La caché pública conserva estos dos campos y las cachés anteriores se tratan como desconocidas para esas coincidencias.

Mi aventura lee únicamente el perfil XP, progreso e insignias del UID activo. Los listeners privados existen solo en esta sección, se retiran al salir/cambiar cuenta y la UI enmascara estados de otro UID antes de volver a enlazarlos. No se atribuyen XP, sellos o insignias desde el dispositivo. El progreso utiliza la proyección del servidor y resuelve duplicados por updatedAt, prefiriendo menor progreso en empates ante revocaciones. Las consultas fallidas o vacías desde caché no se representan como progreso confirmado. Se muestran XP, niveles y nombres de la web, lugares/cantones y la colección de insignias.

Ranking consulta exclusivamente el Top 10 público. Participar es opcional y requiere una acción explícita con alias válido; el cambio se envía autenticado al endpoint existente `https://www.visitaloja.com/api/chabaquito-ranking`, que ejecuta la actualización atómica en servidor. No se escribe Firestore directamente, no se encolan preferencias offline y no se publican datos privados desde la app. No se cambia Worker, reglas, proyectos Firebase ni el panel administrativo. Los beneficios físicos enlazan las condiciones existentes sin generar códigos ni premios nuevos.

La regresión pública de emulador recorre Retos, Mi aventura de invitado, detalle si hay misiones publicadas y Ranking sin cuentas/escrituras. Las pruebas unitarias cubren fechas, metas, UID, revocaciones, niveles, privacidad de ranking, criterios y compatibilidad de caché. Pendiente validar con cuenta real la sincronización tras una visita y la participación/retirada del ranking; no dar esas operaciones por probadas con el recorrido de invitado.

### 0.12.0 — Mi ruta

Inicio → Mi ruta reúne los favoritos publicados, permite ordenar las paradas, iniciar/pausar/avanzar, abrir indicaciones externas y compartir el recorrido. Los favoritos usan la cuenta existente; orden y parada actual permanecen en este móvil, separados por UID e invitado. Avanzar no registra visitas ni entrega sellos. No modifica reglas, backend ni producción.

### 0.13.0 — Menús digitales nativos

La ficha de una parada con menuQrId válido consulta el mismo QR publicado que la web y ofrece Ver menú. Visor nativo con imagen completa, zoom/pan y controles, estados de carga/error, compartir enlace vivo y extras del plan vigente en fecha de Ecuador. El listener se retira al cerrar la ficha y retira el menú ante eliminación/desactivación/error. No se suben imágenes, no se añade WebView ni se cambian reglas, administración o backend.

### 0.14.0 — Avisos nativos opcionales

Inicio o Mi cuenta → Avisos y notificaciones. El visitante inicia sesión, acepta novedades/eventos/promociones y concede el permiso de Android. Firebase Messaging usa el proyecto Android ya configurado; auto-init desactivado inicialmente. La suscripción reutiliza el endpoint existente de avisos y su ámbito canónico, sin cambios de servidor. La renovación de token se sincroniza con WorkManager únicamente para el UID y revisión de consentimiento activos; se cancela al desactivar/cambiar de cuenta. No se registran tokens ni avisos en logs.

El servicio procesa los mensajes de datos que envía el panel, valida texto y destinos públicos y conserva hasta 20 avisos en este móvil. Se abre la sección de avisos al tocar una notificación; las secciones ya implementadas se abren nativamente y las demás en la web canónica. Cerrar sesión revoca la recepción local, cancela avisos/trabajos y elimina el token; una fila remota antigua puede persistir hasta que el servidor descarte el token inválido. Desactivar intenta además confirmar la baja remota. La prueba local no registra el dispositivo ni envía campañas: solo comprueba permiso, canal y presentación. La recepción real desde el panel requiere prueba manual con cuenta y dispositivo; los mensajes del servidor tienen prioridad normal y Android puede retrasarlos en ahorro de batería.
