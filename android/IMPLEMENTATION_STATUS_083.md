# Estado de implementación Android 0.83

Este inventario distingue la experiencia pública de los editores administrativos. No certifica funcionamiento en teléfono ni cobertura completa ES/EN. La referencia histórica PORT_PARITY_AUDIT.md contiene avances acumulados; sus primeras listas corresponden a versiones anteriores.

## Cerrado en esta entrega

Crear cuenta de responsable con correo y contraseña desde Accesos de negocios. Conserva la sesión principal; la cuenta comienza pausada, sin paradas y sin privilegios administrativos. La asignación y activación usan la herramienta existente. No crea cuentas reales durante desarrollo ni envía correos.

## Administración nativa implementada

- Paradas: crear y editar ficha, ubicación, contacto, medios y publicación.
- Eventos generales: crear, editar y publicar.
- Fidelidad por negocio: programa normal y temporadas.
- Directorio de usuarios, permisos administrativos e historial de auditoría.
- Asignación de negocios a propietarios y encargados; crear cuentas de responsables.
- Campañas de notificación y prueba dirigida autorizada.
- Portal de propietario/encargado: operaciones de visitas, clientes y premios y edición autorizada de ficha.

## Herramientas web sin editor nativo equivalente localizado

Comparación de `admin.html` con los puntos de entrada administrativos de Android:

| Grupo | Pendientes concretos |
| --- | --- |
| Guías y contenido | Editor de cantones y rutas; historias; emprendedores; fotografías históricas; postales; podcast |
| Portada y plataforma | Configuración de portada/identidad y bloques; música y video destacados; aliados/marcas; enlaces y mantenimiento |
| Negocios | Catálogo/asignación comercial de planes y suscripciones; editor avanzado de QR/menús y beneficios comerciales |
| Misiones y pasaporte | Editores de misiones Chabaquito, configuración de pasaporte y administración general del centro de recompensas; revisión/gestión de solicitudes de campañas |
| Gestión global | Tableros de control, estadísticas y herramientas de supervisión global; edición/importación masiva de programación de festival |
| Idioma | Selección y textos ES/EN en toda la experiencia, con respaldo para contenido sin traducir |

Que un contenido pueda consultarse públicamente en Android no significa que su editor ya esté migrado. Las opciones específicas dentro de cada editor deben compararse al implementar su módulo: este inventario no declara equivalencia campo por campo. SEO/sitemap siguen perteneciendo a la web.

## Cierre posterior

Pruebas de usuario y revisión en dispositivos al final, como pidió el usuario. Después: configuración de producción, firma de distribución, App Links y publicación Android. No declarar iOS terminado por entregar una APK.

## Avance 0.84: editor nativo de cantones
Añade edición de textos de guía, portada por enlace o subida directa, crédito, campos SEO de la web, hasta 16 destacados y hasta 8 rutas con 2–12 paradas. Permite buscar, añadir, quitar y ordenar paradas/rutas y previsualizar sin publicar. El guardado es transaccional con auditoría, versión y protección contra cambios concurrentes; valida las paradas públicas del cantón al guardar.

El catálogo se carga completo desde servidor (máximo 5000 registros, falla explícitamente si se supera); el buscador muestra hasta 50 coincidencias. No se descartan referencias antiguas silenciosamente.

No incluye todavía borradores persistentes locales de cantones ni las acciones incrustadas de crear/editar fichas: esas fichas se gestionan en el editor de paradas existente. El editor no calcula tiempos ni crea navegación GPS. Las pruebas en teléfono siguen aplazadas. Los otros grupos de editores de la tabla continúan pendientes.

## Avance 0.85: historias y emprendedores
Administración nativa de ambos catálogos: crear, editar, ordenar y eliminar con confirmación. Historias incluye estados, programación en hora de Ecuador, textos ES/EN, portada/galería/audio/video por enlace, coordenadas y selección de paradas relacionadas. Configuración de presentación de Historias y vista previa de texto/imágenes. Mantiene campos no editados y exige recargar ante modificaciones concurrentes; catálogo y auditoría se guardan en la misma transacción.

Pendientes de estos módulos: subir sus archivos directamente, borradores persistentes, reproducción multimedia dentro de la previsualización. Un documento pausado globalmente conserva esa pausa; no se cambia al guardar una fila. No se borran archivos al eliminar filas. Los demás editores y planes/menús/idioma siguen pendientes. Las pruebas en teléfono se aplazan.

## Avance 0.86: borradores y archivos de los editores
Borradores explícitos en archivos privados sin copia de respaldo, separados por cuenta/módulo y con escritura atómica. Se guardan/recuperan/eliminan borradores de filas de historias y emprendimientos y de guías de cantones; máximo 30 por cuenta/módulo y 1 MiB por borrador. Recuperar no publica. Se indica si el contenido compartido cambió desde el guardado del borrador; la publicación posterior conserva la comprobación transaccional contra la versión cargada del servidor. Recuperar un registro ya publicado con el mismo ID abre edición, no crea otro ID. No guarda contraseñas ni el directorio de usuarios. Requiere abrir el módulo y cargar permisos/contenido antes de recuperar; borrar los datos de la app elimina los borradores. No incluye los ajustes de presentación de Historias como borrador.

Imágenes elegidas desde el teléfono para portada, galería y emprendimiento. Audios ES/EN de historias: máximo 20 MiB, valida pista de audio sin video antes de subir. Los archivos se alojan al elegirlos, sus enlaces se conservan en el formulario/borrador y solo se publican al guardar en el servidor. Los videos continúan por enlace. Descartar un formulario no elimina automáticamente los recursos subidos.

**Activación publicada:** PR #81 aprobado y fusionado en main (0a9cc6648b2632272fc2e24721ec6a19afed9572). Despliegue de producción READY y comprobación de autenticación en las rutas canónicas de imágenes de historias/emprendimientos y audio de historias. Conserva los destinos anteriores y la autorización general. No se hicieron subidas reales ni pruebas en teléfono. Los demás editores/planes/menús/idioma siguen pendientes.

## Avance 0.87: Loja en el Tiempo y podcast
Editor de puntos históricos (`loja_tiempo`): crear, editar y eliminar con confirmación; fotografías antes/ahora, etiquetas, descripciones y narraciones ES/EN, coordenadas y enlace para comprobar ubicación. Subida de imágenes y audios del teléfono reutiliza los destinos históricos ya publicados. Lista por páginas de 50 con búsqueda explícita entre los puntos cargados.

Editor de podcast destacado (`siteContent/podcast`): título, etiqueta, duración indicada, descripción administrativa, portada, audio por enlace/ruta publicada y control visible. Igual que la web, este editor no sube archivos del podcast; no es un gestor de múltiples episodios. Los campos adicionales y bloqueos previos se conservan.

Ambos módulos incluyen borradores privados por cuenta y recuperación contra la versión actual del servidor, vista previa de imágenes y audio usando el reproductor compartido (se detiene al salir), y guardados con auditoría atómica/comprobación de cambios concurrentes. No se cambió main ni se escribieron registros reales de contenido.

Pendiente de compatibilidad web ya existente: el visor histórico web conserva su lista al recibir una colección vacía; revisar su caché/fallback al cerrar pruebas de eliminación del último punto. No se declara resuelta esa conducta por implementar el editor nativo. Continúan pendientes otros editores (portada/identidad/aliados/postales/misiones/pasaporte), planes/menús, tableros globales e inglés integral. Pruebas en teléfono al final.

## Avance 0.88: administración de postales
Editor nativo de `settings/postcards` y `settings/postcard_frames`: marca inferior, muestra, frase inicial, tres marcos de marca (disponibilidad/nombre/color), y marcos personalizados por enlace (añadir, editar, ordenar, retirar). Los cambios de marcos se preparan en el formulario y requieren publicar. Comprueba las nuevas imágenes antes de publicar; permite generar una postal de muestra con el mismo renderizador del creador público. Borrador local por cuenta incluye marcos aún sin aplicar. Guardado de ambos documentos y auditoría en una transacción, comparación contra las dos versiones cargadas y conservación de campos adicionales. No borra archivos de imágenes.

Alcance: los marcos se añaden por enlace, igual que en la web; no se añadió subida de archivos de postales. Se conservan los cuatro estilos incorporados; la app muestra hasta 40 marcos personalizados y hasta 50 caracteres del mensaje en la postal, como antes. Los borradores locales no publican y avisan si cambió la configuración. La vista de muestra usa el logo si no se configuró una fotografía. No modifica producción ni contenido real durante desarrollo. Siguen pendientes portada/identidad/aliados, misiones/pasaporte, planes/menús, tableros globales e inglés completo. Pruebas en teléfono al final.

## Avance 0.89: portada y carrusel de apoyo
Editor nativo de `settings/main`: cabecera ES/EN, identidad pública, estilos compartidos, video/música destacados y bloques de `homepageContent`, con catálogo generado desde el esquema web (44 bloques, excluye 6 controles antiguos de galería delegados al gestor de fotos). Edita visibilidad/textos/enlaces/imágenes con respaldo ES/EN donde el esquema lo admite. Solo los bloques proyectados por HomePolicy afectan las presentaciones nativas correspondientes; los demás controles se identifican como web. Las URLs no se convierten en rutas nativas. El logo web no cambia el icono instalado. La biblioteca completa de fotos, autores y encuadres `photoManagerItems` sigue pendiente y se conserva sin modificar. Subida de imágenes de bloques/identidad reutiliza la firma de portada ya publicada; el logo puede conservar transparencia.

Editor nativo de `siteContent/registeredBrands`: textos ES/EN, visibilidad, Mesa Turística, selección automática/manual, inclusión/exclusión por negocio, orden y opciones del carrusel. Catálogo completo de hasta 5000 paradas consultadas en servidor y búsqueda entre elegibles. La elegibilidad usa el filtro de planes de pago vigente del lector nativo; nunca asigna planes ni modifica suscripciones. Conserva referencias a registros no elegibles y orden desconocido. Al publicar incrementa `revision` para interoperar con la comprobación de conflictos web. Previsualización de la selección según la última consulta, sin reproducir la animación. No crea/edita patrocinios dedicados adicionales.

Ambos editores incluyen borrador local por cuenta, confirmación, preservación de campos ajenos y transacción con auditoría/versión cargada. Las imágenes se alojan al elegirlas y los enlaces se publican al guardar. No se modificó main ni contenido real durante desarrollo. Continúan pendientes el gestor fotográfico completo, otros editores (misiones/pasaporte, enlaces y mantenimiento), planes/menús, tableros y cobertura integral de idioma. Pruebas en teléfono al final.

## Avance 0.90: biblioteca fotográfica y créditos
Editor nativo de las tres secciones del gestor web (`settings/main.photoManagerItems`): añadir/editar título, enlace o subida de imagen, autor y enlace, descripción accesible, texto breve, sección y visibilidad. Orden por botones dentro de cada sección; reutilizar en otra sección sin duplicar archivos; retiro con confirmación. Encuadres de portada independientes para computadora/celular con sliders y muestras recortadas; vista de imagen completa y crédito. Los encuadres móviles ya son leídos por HomePolicy; otras galerías conservan su presentación de imagen completa.

Autores guardados: selección y alta/actualización desde el formulario; actualiza las fotos vinculadas del borrador. No elimina autores ni archivos del alojamiento. Subidas usan el firmador de portada existente, máximo 12 MB de entrada y optimización de imagen como otros editores nativos; no modifica main. La muestra de encuadre usa proporciones orientativas, no replica todas las dimensiones de la web.

Las fotos se guardan primero en cambios pendientes y la biblioteca requiere confirmación para publicar. Borrador local por cuenta incluye la foto aún incompleta; conserva metadatos adicionales desde la versión recién leída al recuperar. Publicación transaccional con auditoría y comparación de los tres campos de biblioteca, compatible con el control de concurrencia web y sin sobrescribir ajustes de portada ajenos. No se cambia contenido real durante desarrollo. Pruebas en teléfono siguen para el final; permanecen pendientes los demás módulos del inventario y la revisión de agenda/video en emulador detectada en 0.89.

## Avance 0.91: administración de misiones V2 y configuración básica del pasaporte
Editor nativo de `chabaquitoMissions`: catálogo paginado (hasta 1000, error explícito si se supera), búsqueda/filtro por estado, crear/editar, estados borrador/activa/pausada/archivada, cinco tipos, meta y alcance, insignia (texto/icono/rareza/enlace), fechas opcionales en hora de Ecuador y vista previa. Plantillas generadas del catálogo web; se cargan en borrador y no reemplazan IDs existentes. Cambiar tipo limpia el alcance del formulario para evitar mezclar IDs y categorías. ID permanente al editar. Las nuevas misiones entregan insignias digitales; en las existentes se conservan los vínculos a campañas físicas y metadatos adicionales de insignia. No se añaden ni eliminan campañas o registros de progreso/recompensas de usuarios. No se elimina una misión: se archiva. Guardado transaccional con verificación de versión y auditoría. Borradores locales por cuenta, incluyendo formularios incompletos, con aviso de cambios publicados y bloqueo de colisión de IDs nuevos.

Pasaporte: editor limitado de la campaña actual (`siteContent/passport`) para nombre, mensaje introductorio, activación y periodo de premios. Conserva ID de campaña, premios/alternativas Turista y Lojano, negocios y permisos de canje. No crea campañas nuevas; requiere una previamente configurada. Borrador local, confirmación y transacción/auditoría compartidos con la plataforma. Desactivar premios no borra sellos. El editor completo de recompensas/asignaciones, solicitudes de campañas, presentación/personaje/certificado legacy de Chabaquito y los demás grupos del inventario siguen pendientes. No se modificó main ni contenido real. Pruebas en teléfono al final.

## Avance 0.92: premios y negocios de entrega del pasaporte
Editor nativo para la campaña existente de `siteContent/passport`, con modos Turista/Lojano: premio principal, textos/imagen por enlace/código editorial/botón/enlace HTTPS, negocio que entrega, visibilidad, hasta nueve alternativas por modalidad, edición/retirada y vista previa. Selección y búsqueda entre cuentas de canje ya registradas y activas; no crea cuentas ni cambia roles globales. La visibilidad del principal controla la modalidad completa, como en el editor web. El ID de campaña permanece intacto; las campañas nuevas siguen configurándose en la web. Si hay estados principal/modalidad incompatibles, falla explícitamente para no normalizarlos de forma silenciosa.

Publicación transaccional de ambos mapas de premios, permisos `passportGrants` de la campaña actual y auditoría: reemplazo de mapas completos por campos para retirar realmente las alternativas, preservando metadatos adicionales conocidos en los registros conservados; lectura/verificación de campaña y todos los negocios cargados antes de escribir. Catálogo paginado completo hasta 400 cuentas, con error explícito si lo supera para respetar límites de transacción. No escribe en cuentas cuyo conjunto de permisos permanece igual, ni cambia permisos de otras campañas o modalidades desconocidas. La lista de cuentas debe actualizarse si se modifica durante la edición. No toca sellos, códigos ni canjes emitidos; la autorización de los canjes legacy puede cambiar al reasignar permisos de esta campaña, como en la web. Los canjes modernos conservan su snapshot de premio y negocio.

Borrador local por cuenta y campaña (incluye alternativas incompletas), aviso si cambió la configuración, confirmación de publicación y cancelación de cambios. Imágenes por enlace, como en el formulario web; no se añadió carga de archivos de premios. No se modificó main ni contenido real. Siguen pendientes campañas nuevas desde la app, centro general de recompensas/campañas y solicitudes, configuración legacy de Chabaquito, planes/menús, enlaces/mantenimiento, tableros e idioma integral; pruebas en teléfono al final.

## Avance 0.93: enlaces oficiales y mantenimiento web
Directorio nativo de los diez accesos oficiales del panel web, generado desde `SYSTEM_LINKS`: destinatario, explicación, búsqueda, copia al portapapeles y apertura de la URL canónica. No contiene tokens, códigos de visita o sesión; no reemplaza QR dinámicos ni concede permisos. Es un directorio de páginas web, no una migración adicional de sus funciones. El generador tiene comprobación de sincronización en CI.

Mantenimiento: editor administrativo de `siteContent/maintenance`, con estado, etiqueta, título, mensaje, botón HTTPS opcional y texto de regreso, muestra de contenido sin activar, borrador privado por cuenta, confirmación explícita y guardado transaccional con comparación de versión y auditoría. Afecta al aviso de la web pública; no bloquea la app nativa ni el panel web. El texto de regreso no programa una desactivación. Estado inicial apagado; no usa un WhatsApp ficticio de respaldo para el botón. Se puede desactivar un aviso antiguo sin tener que corregir un enlace legado que no cambió. Metadatos ajenos se conservan.

Contacto/redes ya estaban en el editor de portada desde 0.89: se añade acceso directo a ese bloque dentro del mismo formulario, sin otro editor ni configuración duplicada. El catálogo ahora identifica Contacto y Texto del pie como contenido compartido que ya consume PlatformPolicy. No se cambiaron contenidos reales ni main. Permanecen pendientes los otros grupos del inventario, las verificaciones de pantallas y las pruebas en teléfono al final.

## Avance 0.94: personaje, mensajes y presentación clásica de Chabaquito
Editor nativo de `siteContent/chabaquito`: imagen por URL o subida de PNG/JPG optimizado, visibilidad, animación web, ocho mensajes contextuales, textos ES/EN y visibilidad de los cinco retos clásicos, textos y visibilidad del certificado clásico. Esquema de valores iniciales generado del formulario web, con comprobación de sincronización en CI. Bloques seleccionables, muestra de contenido sin generar un certificado ni desbloquear logros, borrador local por cuenta, confirmación de publicación y transacción/auditoría con verificación de versión. Se preservan campos adicionales de cada grupo, toda la configuración `benefit` y documentos de existencias/campañas; no se escribe en las definiciones, progreso o insignias de misiones V2. La campaña comercial sigue pendiente de su editor específico.

La guía nativa y su acceso en Inicio ahora leen imagen, visibilidad y saludo inicial desde ese documento público; listener activo solo con la pantalla en primer plano, respaldo con dibujo incorporado si no hay imagen o falla su carga. Ocultar el personaje retira su imagen, sin bloquear las recomendaciones de la guía. El saludo personalizado se usa en español; se conserva el texto inglés existente. Animación, mensajes de otros contextos, los cinco retos clásicos y su certificado pertenecen a la presentación web: administrarlos desde la app no crea una segunda experiencia clásica nativa ni modifica los retos V2.

Subida usa el firmador de portada existente, conserva transparencia y solo incorpora el enlace al formulario; es necesario guardar borrador o publicar para retenerlo. No modifica main ni contenidos reales durante desarrollo. Continúan pendientes los demás módulos del inventario, la revisión de pantallas y las pruebas en teléfono al final.
