# V79 — Loja en el Tiempo

Base V78 87c1d2b. Rama exclusiva design/modernizacion-web-v1.

## Cambios y problemas corregidos

Presentación editorial en dos columnas en escritorio, apilada en móvil; visor amplio, navegación que permite títulos largos, controles táctiles de 44/46 px y colores de alto contraste. Se conserva el contenido, las fotos, audios ES/EN y acciones existentes.

El visor antiguo cambiaba el ancho del contenedor de la foto del pasado: la imagen seguía ese ancho y podía cambiar de encuadre durante la comparación. Ahora recorta una imagen de ancho completo mediante clip-path, manteniendo su tamaño. Se conserva el arrastre táctil/ratón y se añade un control nativo con teclado (flechas, Inicio, Fin). Ambos controles se sincronizan y vuelven a 50 al cambiar de lugar. Se detiene el arrastre al cancelar un toque o perder foco. La navegación comunica la selección mediante aria-pressed y escapa los nombres antes de insertarlos en HTML.

| Contenido | Administrador |
| --- | --- |
| Título y descripción | Loja en el Tiempo → Presentación de esta sección, existentes |
| Etiqueta de patrimonio y ayuda del comparador | Mismo editor, nuevos textos bilingües |
| Lugares, fotografías, etiquetas Ayer/Hoy y audios ES/EN | Formulario existente de puntos históricos, sin duplicación |

Los textos nuevos comparten borradores locales/publicación existentes del editor. No se cambiaron colecciones, permisos, QR, pasaporte, recompensas o misiones. No hubo escrituras de datos reales ni modificaciones de main/producción.

## Pruebas

- 26/26 tests técnicos existentes aprobados; validador de sitio, sintaxis y diff correctos.
- Visor real aislado a 320/390/768/1024/1440 px: teclado, arrastre con ratón, extremos 0/100, reset al cambiar lugar, ancho constante de la foto anterior, nombres largos, selección accesible, textos ES/EN, acciones existentes de audio/mapa delegadas, controles ≥44 px, sin errores JavaScript ni desbordamiento.
- Capturas móvil/escritorio inspeccionadas; corregido el texto claro heredado sobre el botón claro del mapa. Su color calculado se comprueba automáticamente.
- Regresión del administrador a 390 px, incluida presencia única de los cuatro campos nuevos ES/EN, con Firebase/Cloudinary simulados.

[Escritorio](v79/time-desktop.webp) · [Móvil](v79/time-mobile.webp) · [Resultados](v79/time-report.json).

## Límites y prueba del propietario

Las fotografías de QA son la misma imagen del repositorio en color/gris para comprobar la geometría; los puntos y servicios son simulados. Capturas con movimiento reducido y fuentes/iconos remotos ausentes. No certifican la alineación de cada pareja histórica real ni la reproducción de sus audios. Arrastre táctil en dispositivo físico pendiente.

En la Preview abrir #loja-tiempo: elegir lugares, comparar con dedo/ratón y teclado; comprobar la reproducción del audio español/inglés con contenido existente. En admin.html → Loja en el Tiempo abrir Presentación de esta sección y verificar Etiqueta de patrimonio/Ayuda del comparador. Se puede editar un borrador local; no publicar ni guardar un punto para esta revisión de solo lectura. La publicación real requiere una edición expresamente autorizada porque usa Firebase compartido.
