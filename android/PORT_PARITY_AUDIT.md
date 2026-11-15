# VisitaLoja: pendientes concretos del port Android

Revisión de código: 7 de noviembre de 2026, hora de Loja.

Base web: `main`, commit `22b2cec5fc0190ab3fdd4ea12b215b855643b9fc`.
Base Android: versión 0.59, rama `design/android-app-v1`, commit `0eba33bb6770c8b8e0b764a8889d447d8fd58d55`.

Esta comparación verifica implementación y fuentes de datos. No certifica entregas FCM, comportamiento del GPS real ni operaciones con cuentas privadas. No se han enviado avisos ni cambiado datos de usuarios.

## Inventario de funciones presentes

| Área | Implementación Android localizada | Situación |
| --- | --- | --- |
| Directorio y mapa | PlacesRepository, MapScreen, NativeMapView, PlaceInformation | Existe; revisar presentación y GPS en dispositivos reales |
| Fichas, fotos, video, menú y opiniones | PlaceGallery, PlaceMediaEntry, BusinessMenuEntry, DirectMenuEntry, ReviewsEntry | Existe; comprobar una parada representativa de cada modalidad |
| Cuenta, perfil y avatar | AccountViewModel, AccountScreen, ProfileEditor | Existe; falta alta explícita con correo |
| Favoritos y agenda guardada FIAVL | AccountViewModel, AccountPolicy | Existe sincronización mediante userProgress; falta prueba cruzada web/app |
| Eventos y festival | AgendaScreen, FestivalScreen, FestivalViewModel | Existe, con mapa del festival, recorrido del desfile, calendario y filtros |
| Pasaporte, fidelidad y premios personales | WalletViewModel, WalletScreen, WalletRewardPolicy | Existe; falta completar el ciclo real de canje |
| Historial personal | PersonalVisitsViewModel, PersonalVisitsScreen | Existe, con páginas de 50, filtros, consumo confirmado y anulaciones |
| Encargados | MerchantScanScreen, MerchantRewardScreen, MerchantBusinessScreen | Existe sellado, consulta, entrega y anulación; completar pruebas reales pendientes |
| Misiones e insignias | MissionViewModel, MissionsScreen | Existe lectura de misiones, progreso, insignias y ranking |
| Cantones | CantonPolicy, CantonsViewModel, CantonsScreen | Existe guía y directorio; faltan rutas configuradas por cantón |
| Historias, emprendedores y fotografías | CultureViewModel, DiscoveryViewModel, DiscoveryScreens | Existen, con fuentes compartidas con la web |
| Videos, podcast, música y postales | VideoViewModel, YouTubePlayer, DiscoveryAudioViewModel, WelcomeMusicControl, PostcardScreen | Existen; revisión audiovisual en móvil pendiente |
| Tienda | ShopViewModel, ShopScreen, ShopPolicy | Existe catálogo y preparación de pedido; confirmar recorrido real de pedido |
| Mesa Turística, aliados y contacto | MesaViewModel, SupportersViewModel, PlatformViewModel | Existen fuentes compartidas con la web |
| Anuncios y promociones | AnnouncementEntry, AnnouncementViewModel, HomeCampaigns, PromotionsScreen | Existen programación y lectura de beneficios; no son módulos pendientes de crear |
| Avisos y cercanía | NativePush, PushViewModel, NearbyGeofences | Existen; FCM remoto y proximidad real requieren comprobación |

## Lista de implementación pendiente

### P1. Crear cuenta de cliente con correo

La web tiene un flujo explícito de registro en `js/customer-login-v227.js`. Android usa `signInWithEmailAndPassword` y Google, pero no presenta registro mediante `createUserWithEmailAndPassword`.

Resultado esperado: alternar ingresar/crear cuenta, confirmar contraseña, explicar errores y permitir completar el perfil usando el flujo actual. Crear una cuenta no debe otorgar roles, suscripciones, visitas ni premios. Mantener el acceso Google existente.

### P1. Reflejar los controles de portada del panel

La web normaliza `homepageContent.blocks` y aplica `enabled` en `js/homepage-content.js`. Android consume parte del texto, fotos y ajustes de la cabecera en `HomePolicy`, pero no aplica de forma general esos controles a los bloques correspondientes de Inicio.

Resultado esperado: mapear explícitamente los bloques equivalentes, respetar sus textos y opciones de visibilidad donde correspondan y conservar valores predeterminados si no existe configuración. No ocultar por extensión pantallas independientes ni interpretar enlaces arbitrarios como rutas nativas.

### P1. Completar enlaces entre web y app

`NativeLinkPolicy` reconoce destinos que el manifiesto no registra todos para apertura desde Android, entre ellos categorías y la programación FIAVL. También debe revisarse la ficha de cantón: la web usa un cantón concreto, mientras el enlace `/cantones.html` se interpreta como directorio general en el parser actual.

Resultado esperado: probar enlaces externos y compartidos de parada, menú, categoría, festival y cantón. Resolver parámetros válidos sin perder el destino, conservar rechazo de URLs ambiguas y ofrecer salida coherente para destinos no soportados. Registrar filtros no equivale a verificar Android App Links; la verificación de dominio es una tarea aparte.

### P2. Rutas configuradas por cantón

La web admite `routes` con título, duración, notas y `placeIds` en `js/canton-content.js` y los utiliza en `js/canton-experience.js`. `CantonGuide` no contiene ni interpreta estas rutas.

Resultado esperado: presentar las rutas publicadas existentes, sus notas y paradas en orden, con accesos a fichas y al recorrido disponible. Filtrar paradas no publicadas o ajenas al cantón. No inventar rutas ni interpretar la duración orientativa como navegación calculada.

### P2. Idioma coherente

La web dispone de contenido ES/EN en sus bloques de presentación. La app tiene alternativas en la portada y algunos módulos, pero no una selección compartida que abarque toda la experiencia.

Resultado esperado: definir alcance ES/EN, guardar una preferencia, aplicarla a navegación y módulos incluidos, y utilizar español como respaldo cuando el administrador no haya escrito traducción. No afirmar que textos originales de los negocios se traducen automáticamente.

### P1 para cerrar notificaciones. Prueba remota aislada en Android

La prueba local de `NativePush.localTest` solo valida presentación. En `functions/push-campaigns.js`, la acción de prueba utiliza el token proporcionado por el flujo del panel; no se debe dar por probada una entrega al APK por haber recibido una prueba en el navegador.

Resultado esperado: disponer de una selección inequívoca del Android de prueba autorizado, sin envío general accidental; comprobar recepción con app en segundo plano y cerrada normalmente, registro en Avisos y destino al abrir. Distinguir aceptación de FCM de recepción observada en el dispositivo. Respetar permiso y consentimiento existentes.

## Pruebas que faltan, no módulos nuevos

1. Web/app con la misma cuenta: favoritos, perfil, avatar y agenda FIAVL; comprobar que una escritura no borre los otros campos.
2. Encargado/cliente: sello, límite diario, fidelidad, pasaporte, premio pendiente, entrega única y anulación elegible; verificar bloqueos al intentar repetir.
3. Dispositivo real: GPS, permisos, cercanía en segundo plano, batería y notificación remota.
4. Revisión visual y audiovisual: tamaños de letra, pantallas pequeñas, logos, afiches, galerías, YouTube, música, postales y estados sin conexión.

Las pruebas manuales se mantienen para después, según lo acordado. Las comprobaciones automáticas adecuadas acompañarán cada implementación.

## Alcance de administración

El panel central web sigue siendo el lugar existente para configurar contenido, accesos, campañas y avisos. El port de las pantallas públicas no implica reconstruir cada editor administrativo dentro del APK. La configuración de beneficios que ya admite el portal del negocio debe compararse aparte si se decide llevar también esa edición a Android.

SEO, sitemap y páginas destinadas a Google siguen siendo funciones de la web; no son pantallas que falten en Android.

## Orden propuesto para los siguientes bloques

1. Registro con correo y enlaces de entrada: cerrar acceso y navegación.
2. Configuración de portada y rutas por cantón: completar contenido administrado.
3. Idioma compartido y cierre de la prueba FCM Android.
4. Ejecutar las pruebas reales acordadas y corregir diferencias visuales.

No se asigna un porcentaje: contar pantallas existentes no mide la paridad de sus opciones ni su validación real.

## Seguimiento: implementación 0.60

- Se añadió el registro explícito con correo y confirmación de contraseña, usando el mismo Firebase Auth. El registro no escribe roles, visitas, premios ni suscripciones.
- Se añadió resolución de `/canton/{id}` y de un parámetro `canton` válido en el directorio, conservando el cantón al abrir la pantalla nativa.
- Se ampliaron los filtros de enlaces Android para categorías, cantones y festival. Continúa pendiente verificar el dominio para apertura automática de Android App Links; el sistema puede pedir elegir la aplicación.
- Permanecen pendientes las pruebas reales de creación/acceso con cuenta nueva y apertura de enlaces desde aplicaciones externas. Las pruebas unitarias no sustituyen esas comprobaciones.

## Seguimiento: implementación 0.61

- Las guías Android leen las rutas existentes de cada cantón: título, duración orientativa, notas y hasta 12 paradas por ruta, con un máximo de 8 rutas como la web.
- Se muestran únicamente recorridos completos de al menos dos paradas publicadas del mismo cantón, conservando el orden administrado. Una ruta incompleta se oculta entera; no se inventan sustituciones.
- Cada parada ofrece ficha y, cuando dispone de coordenadas válidas, indicaciones externas. Se puede compartir el recorrido y acceder a la página pública del cantón.
- Los destacados muestran también la etiqueta Recomendado, además del orden ya existente.
- No se crearon rutas de muestra ni se escribieron datos de contenido. Si el panel todavía no contiene rutas completas, la sección permanece oculta como en la web.

## Seguimiento: implementación 0.62

- Inicio aplica la visibilidad de welcomePassport, welcomeMissions, shopGateway y provinceGateway a sus accesos equivalentes. Todas las secciones conserva sus pantallas independientes.
- Los accesos de pasaporte, misiones, tienda y cantones, y los títulos de paradas, postales, tiempo y podcast leen sus textos correspondientes del panel. ES/EN usa español como respaldo si falta traducción.
- Se ignora enabled para bloques marcados noVisibility en el esquema web. Los enlaces configurados no se ejecutan ni se convierten en rutas nativas.
- Una consulta fallida conserva la última configuración de inicio y muestra el estado de error existente; no reactiva accesos ocultos por un fallo de red.
- La fila final de accesos mantiene ancho uniforme cuando se ocultan tarjetas.
- Este bloque no constituye traducción global ni paridad de todos los editores web. Pendiente comprobación visual en dispositivo.

## Seguimiento: implementación 0.63

- La selección ES/EN se guarda como preferencia de presentación del teléfono y se comparte entre Inicio, navegación y Todas las secciones. Se puede cambiar desde Inicio o el directorio y se vuelve a leer al iniciar el proceso.
- Se traducen las cinco opciones inferiores, ayudas de navegación, títulos/descripciones/filtros del directorio y el diálogo para abrir enlaces. El directorio busca simultáneamente en español e inglés y conserva los identificadores de destinos y grupos.
- Se reutiliza el respaldo español de los textos administrados de Inicio. Los contenidos de negocios, eventos y pantallas interiores que aún carecen de traducción conservan su idioma original; no se declara traducción global.
- No cambia el idioma del sistema, los datos de cuenta ni los contenidos del panel. La preferencia pertenece al dispositivo y continúa al cerrar sesión.
- Pendiente revisión física de idioma tras cerrar/reabrir y del diseño con texto grande.

## Seguimiento: implementación 0.64

- Explorar y Favoritos usan la preferencia ES/EN: encabezados, filtros, ayuda, recuentos, búsqueda, estados vacíos y acciones de tarjetas.
- Las fichas traducen sus acciones principales, categorías, copiar dirección, indicaciones, compartir, horario, servicios y métodos de pago. Se presenta hoursEn cuando existe y se conserva el texto publicado como respaldo; no se inventan traducciones de nombres, direcciones, descripciones o condiciones de promociones.
- La búsqueda reconoce coffee, lodging, hotels, accommodation, restaurants, food, tourism, sightseeing, bakery/bakeries y crafts conservando las reglas de publicación y filtros.
- Una búsqueda sin coincidencias en Favoritos ofrece borrar la búsqueda y distingue ese caso de no tener lugares guardados.
- Los visores independientes de menús, opiniones, multimedia y otros módulos conservan textos pendientes de traducción. Continúan pendientes pruebas físicas y FCM remoto.

## Seguimiento: implementación 0.65

- Menú QR y enlaces directos usan ES/EN en carga, retiradas, errores, zoom, compartir y cierre. El menú sigue siendo la imagen publicada; no se traduce la imagen ni se ejecuta el destino del QR.
- Opiniones usa ES/EN en lectura, filtros, fechas, formulario, consentimiento y confirmación. Conserva las validaciones y los datos enviados; nombres y comentarios permanecen tal como se publicaron. Mensajes técnicos del servidor pueden conservar español.
- Los controles de video y narraciones de la ficha distinguen el idioma de interfaz del idioma real de cada grabación; no traducen el audio.
- La carta de productos inicia con la preferencia ES/EN de la app y conserva su selector local. Sus formularios independientes de pedidos/reservas y los reproductores internos aún tienen textos por traducir.
- No se enviaron pedidos, opiniones ni mensajes en pruebas; pendientes validación física y pruebas privadas.

## Seguimiento: implementación 0.66 · funciones agrupadas

- Herramientas nativas del negocio: editar descripción, teléfono, WhatsApp, horario, logo, portada y galería; selección de imágenes, compresión, orientación EXIF y subida mediante la firma Cloudinary existente. Guarda solo cambios autorizados y detecta edición concurrente.
- Campañas nativas de cumpleaños: activación, título, condiciones, días previos/posteriores y consumo mínimo; utiliza birthdayOffers con las mismas autorizaciones y confirmación antes de guardar.
- Configuración del premio habitual y de temporadas existentes, mediante un servicio autenticado de propietario que conserva metas, fechas, sellos, stock y contadores. Requiere publicar la nueva ruta del servicio; no permite crear programas ni cambiar permisos.
- Exportación CSV de las filas cargadas de clientes/visitas/premios, correo enmascarado y protección frente a fórmulas. Las configuraciones avanzadas existentes quedan accesibles mediante un botón explícito al portal web.
- Planes: pantalla nativa y accesos desde Inicio y Secciones, usando settings/subscriptions y la oferta compartida vigente. Consultar abre Contacto, sin iniciar un pago ni asignar planes.
- Notificaciones: Android registra plataforma y etiqueta; el panel puede listar y seleccionar dispositivos propios suscritos para una prueba aislada sin exponer tokens. Revalida cuenta, consentimiento y token antes del envío. No se enviaron pruebas.
- App Links: autoVerify y assetlinks para el paquete de pruebas y su firma estable, preparados en rama. La apertura verificada depende de publicar el archivo en el dominio canónico; el alias sin www conserva recepción separada sin verificación automática, todavía sin desplegar main.
- Pedidos y reservas incorporan las traducciones de sus controles principales. Textos publicados y algunos mensajes técnicos conservan el idioma original.
- A petición del usuario, las pruebas de uso y emulador quedan para después; el workflow permite ejecutarlas manualmente con run_ui. Se mantiene la compilación y comprobaciones automáticas de código. No se publican campañas ni se cambian cuentas o datos reales durante el desarrollo.

- Se completa la entrega de cumpleaños desde una visita confirmada: consulta de oferta y ventana anual, comprobación del consumo mínimo y confirmación explícita de presencia/fecha. El servidor conserva un único registro por usuario/parada/año y resuelve duplicados de forma transaccional. Esta nueva operación también necesita publicar el servicio preparado.

- Los nuevos códigos nativos incorporan nombre, modo lojano/turista, ciudad y mes/día de cumpleaños desde el perfil confirmado, sin documento ni año de nacimiento. El servicio de cumpleaños usa el perfil actual y admite códigos antiguos sin mes/día.

## 0.67 — informes del encargado

- CSV por pestaña con fechas en hora de Loja, consumos, estado, comprobantes y anulación; correos protegidos y neutralización de fórmulas. Solo exporta filas cargadas que coinciden con los filtros.
- Confirmación visible de guardado y mensaje si no puede escribir el archivo.
- Filtro de visitas de este mes y resumen que cuenta únicamente visitas confirmadas.
- Servicios de 0.66 publicados mediante PR76; revisión en dispositivo y con cuentas reales pendiente por solicitud del usuario.

## 0.68 — cierre de cercanía

- La vuelta a primer plano conserva registros saludables para no reiniciar el tiempo de permanencia. Se renuevan tras seis horas, al cambiar catálogo, en el primer arranque del proceso, reinicio/actualización, cambios de disponibilidad o revisión explícita.
- El error de geofencing invalida la marca local de registro; desactivar limpia la marca. El catálogo continúa caducando y no se envían coordenadas.
- Configuración con GPS, ahorro de batería, fecha de activación, último aviso y acceso al canal específico de notificaciones. Se conserva el radio solicitado de 60 m; Android puede demorar o perder la detección.
- Prueba de emulador ampliada: activación voluntaria, GPS apagado, registro Play Services, vuelta a primer plano y desactivación. La entrega física en segundo plano requiere prueba en dispositivo real.

## 0.69 — alcance de cercanía confirmado por el propietario

- Avisos exclusivamente para categorías gastronómicas: cafeterías, restaurantes, bares, huecas, comida urbana, panaderías, heladerías, asaderos y cevicherías. Marcas aliadas excluidas, incluso con una categoría gastronómica adicional.
- El filtro se aplica al registro y nuevamente a cada aviso, para rechazar zonas o catálogos anteriores que incluyan marcas aliadas. Otros puntos permanecen en el mapa.

## 0.70 — apertura de avisos y revisión de cierre

- Cada aviso general tiene su PendingIntent propio y abre el destino nativo validado del aviso guardado para la cuenta actual. Al faltar historial/cambiar la cuenta, abre Avisos; nunca acepta un destino arbitrario del Intent.
- El historial usa la misma resolución nativa de enlaces que los enlaces externos, incluyendo filtros y actualización de la parada.
- Dar de baja novedades cancela solo su canal, conservando los avisos independientes de cercanía.
- Prueba ampliada de notificación local, toque y apertura sin cuenta; activadas las revisiones de mapa, festival, directorio y logos en emulador. No se envían campañas ni se registran cuentas, visitas o canjes reales.
- Revisión de código de sincronización: actualizaciones transaccionales de campos propios para favoritos/agenda; avatar y perfil mantienen los campos del otro flujo. La prueba cruzada con la cuenta real continúa pendiente.

- Revisión de mapa 0.70: el error de consulta se diferencia de una búsqueda sin resultados, con reintento desde el indicador; «Ver todas» limpia los filtros al no haber coincidencias.

## 0.71 — fotografías completas en las paradas

- Las imágenes de tarjetas, portada y vista previa del mapa usan ajuste completo, sin recorte. Categoría y favorito fuera de la fotografía en las tarjetas.
- La ficha abre con galería deslizable de altura adaptada a la proporción y al tamaño de pantalla, contador y ampliación. Foto principal primero, sin duplicarla y conservando créditos. Se elimina la galería repetida del cuerpo de la ficha.
- Visor completo compartido con las galerías existentes; conserva navegación lateral y créditos. Comprobación visual de ficha, listado y visor con registros públicos, sin modificar imágenes ni datos de negocios.
- El mismo ajuste completo se aplica a las tarjetas de paradas en cantones y misiones, y a las imágenes de promociones.
