# V80 — Podcast y presentación multimedia

Base V79 628c74c. Rama exclusiva design/modernizacion-web-v1.

## Problemas y cambios

La sección repetía dos encabezados centrados con espacios amplios y una portada desproporcionada. Se reorganiza en una composición editorial de dos columnas en escritorio, apilada en móvil, con portada cuadrada contenida, descripción y tarjeta de audio destacada. Se conserva el reproductor nativo, sus controles, archivos y eventos; no hay reproducción automática.

Los títulos largos de episodios ahora se muestran completos. Se mantiene el contraste entre texto oscuro/fondo claro y texto claro/tarjeta oscura. Se añade un mensaje de fallo accesible cuando el audio o su source informa un error; se retira al cargar metadatos o reproducir. Ocultar el audio desde su configuración detiene la reproducción.

Las URL del audio y portada ahora rechazan esquemas ejecutables, credenciales y enlaces HTTP, conservando HTTPS y rutas de archivos locales. La configuración pública inválida mantiene la fuente anterior; el administrador rechaza guardar esas URL sin escribir. No se eliminan archivos. Se corrige la ayuda antigua que confundía editar enlaces con subir archivos.

| Contenido | Control del administrador |
| --- | --- |
| Etiqueta, titular e introducción editorial | Audios y Podcast → Podcast: presentación, nuevos campos ES/EN |
| Título, descripción y etiqueta sobre reproductor | Mismo editor; título/descripcion existentes, etiqueta conectada |
| Mensaje de fallo | Mismo editor, texto ES/EN |
| Título de episodio, duración, etiqueta, URL de audio/portada, mostrar/ocultar audio | Formulario existente de Audio de muestra; sin duplicar |

La descripción administrativa permanece interna. No se han creado subidas de podcast ni aplicado cambios de permisos o backend. Nuevos textos comparten el editor de borradores locales/publicación. No se modificaron las reglas de Chabaquito, misiones, QR o pasaporte. No hubo cambios en main, producción ni datos reales.

## Pruebas

- 27/27 tests técnicos, incluido el nuevo validador de URL. Sintaxis, validador integral y diff correctos.
- Sección y configuración reales aisladas a 320, 390, 768, 1024 y 1440 px: reproducción de WAV generado de prueba, ausencia de autoplay, evento play conservado, ocultar detiene audio, fuentes inválidas conservan el archivo anterior, error/recuperación simulados, textos ES/EN, títulos largos, portada 96×96, reproductor ≥44 px, sin desbordamiento ni errores JavaScript.
- Capturas escritorio/móvil inspeccionadas; corregida una regla antigua que imponía tamaño distinto de portada.
- Regresión del administrador a 390 px: diez campos nuevos ES/EN únicos; URL ejecutable rechazada sin escrituras; flujos multimedia anteriores con proveedores simulados.

[Escritorio](v80/podcast-desktop.webp) · [Móvil](v80/podcast-mobile.webp) · [Resultados](v80/podcast-report.json).

## Pendientes y revisión del propietario

QA usa foto del repositorio y WAV generado, con fuentes/iconos remotos ausentes y proveedores aislados. No certifica archivos o CDN reales, ni una recompensa real de Chabaquito. El mensaje de fallo sigue los errores del navegador; no se inventa un temporizador para conexiones lentas.

En la Preview abrir #podcast y reproducir el archivo guardado. En admin.html → Audios y Podcast abrir Podcast: presentación para revisar los textos nuevos. Puede guardarse un borrador local; publicar o guardar Audio de muestra escribe en Firebase compartido y requiere una edición real autorizada. Queda pendiente comprobar ese guardado real y la reproducción de los archivos del propietario. Para esta revisión no cambiar URLs ni publicar.
