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
