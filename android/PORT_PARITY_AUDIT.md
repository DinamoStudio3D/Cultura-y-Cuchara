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
