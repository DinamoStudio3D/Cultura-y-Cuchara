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
