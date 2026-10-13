# V78 — Portada administrable y tarjetas de descubrimiento

Base V77 54a08dd; rama exclusiva design/modernizacion-web-v1.

## Configuración y ubicación

| Elemento | Control en el administrador | Implementación |
| --- | --- | --- |
| Composición de portada | Apariencia y Marca → Apariencia premium → Estilo de portada | Reutiliza el control existente: fondo completo, foto lateral o lateral enmarcada |
| Altura | Mismo apartado → Altura mínima de portada | Reutiliza alturas compacta, estándar, inmersiva; el contenido largo siempre puede crecer |
| Luminosidad | Mismo apartado → Luminosidad de la fotografía | Reutiliza el valor existente heroImageOpacity como nivel de luminosidad: 55 mantiene el aspecto V77; se protege el texto independientemente |
| Encuadre general y carrusel | Portada e identidad | Conserva URL, posición, intervalo y logo existentes |
| Encuadre móvil | Portada e identidad → Encuadre de la fotografía en móvil | Nuevo selector; por defecto usa el encuadre general; incluye vista previa de la primera foto |
| Buscador | Editor Contenido de la portada → Buscador de portada | Pregunta, botón y ejemplo del campo en ES/EN; mantiene la función de búsqueda |
| Mensaje y ubicación sobre foto | Mismo editor → Mensaje sobre la fotografía de portada | Texto/ubicación editable; mostrar u ocultar el mensaje |
| Accesos rápidos | Bloques Acceso rápido del mismo editor | Reutiliza textos existentes y añade mostrar/ocultar individual. Todos ocultos retiran la barra vacía |
| Categorías | Paradas y negocios → Tarjeta de categoría | Nuevos campos de presentación ES/EN para nombre e icono de las 11 tarjetas; conteos derivados. Identificadores y nombres internos de filtros intactos |
| Tarjeta de agenda en categorías | Agenda → Presentación de esta sección | Texto y descripción ES/EN añadidos al editor existente |
| Textos de tarjetas de lugares | Paradas y negocios → Textos de las tarjetas de lugares | Antetítulo y llamada a detalles ES/EN; se reaplican tras regenerar las tarjetas |
| Fotografías de tarjetas | Apariencia premium → Fotos de las tarjetas de lugares | Recorte para llenar o foto completa. Marcas aliadas mantienen encuadre completo |
| Estilo y esquinas | Apariencia premium | Reutiliza Elevadas/Contorno/Suaves y tamaño de esquinas. Sin controles duplicados |

El botón de configuración dice Publicar configuración porque escribe la configuración pública. La vista previa del encuadre solo lee campos e imágenes, no guarda ni sube archivos. Los borradores locales del editor de textos permanecen separados; no cubren las opciones de settingsForm.

## Diseño y preservación

Categorías en tarjetas compactas con icono, nombre y conteo. Lugares con imagen proporcionada 4:3 y detalle debajo, acciones táctiles de 46 px, logo aliado completo, etiquetas con pares de color de alto contraste. Se corrigió la prioridad de estilos antiguos que imponían tarjetas horizontales y se excluyen hidden-item de los estilos que muestran tarjetas para conservar el filtrado.

No se cambiaron reglas de pasaporte/QR, premios, misiones, prioridad comercial o GPS. No hubo cambios en main, producción, reglas desplegadas ni datos reales. Mostrar/ocultar un acceso no elimina registros ni desactiva el módulo.

## Pruebas completadas

- 26/26 tests de opciones, contenido, borradores, multimedia, seguridad, colores, instalación y caché.
- Sintaxis de JavaScript e inline admin; validadores de sitio e imágenes y git diff --check correctos.
- Portada a 320, 390, 768, 1024 y 1440 px: tres composiciones, campos administrables, encuadre móvil, ocultar/restaurar accesos, búsqueda, contenido largo y ausencia de desbordamiento.
- Tarjetas a 320, 390, 768 y 1440 px: renderizadores reales con datos y dependencias simuladas; edición de nombres/iconos de categorías ES/EN y persistencia tras renderizar; delegación de categoría, detalles por teclado, favorito y QR; aliados sin QR de gastronomía; fotos completas/recorte, variantes y textos reaplicados tras renderizar. Ocultar una tarjeta mediante hidden-item mantiene el filtrado. Etiquetas comprobadas con contraste calculado ≥4.5:1. Acciones ≥44 px. Sin errores JS.
- Administrador a 320, 390, 768 y 1440 px: regresión multimedia y borradores, control único de estilo, carga y guardado simulados de encuadre móvil y ajuste de foto. Comprobación adicional a 390 px de la vista previa de encuadre.

[Tarjetas móvil](v78/cards-mobile.webp) · [Tarjetas escritorio](v78/cards-desktop.webp) · [Resultados de tarjetas](v78/cards-report.json) · [Resultados de portada](v78/welcome-report.json).

## Límites y revisión del propietario

Los tests aíslan Firebase, imágenes remotas, Leaflet y servicios externos. Las tarjetas utilizan la foto del repositorio y negocios simulados; no certifican todos los encuadres de datos reales ni la disponibilidad de logos/Font Awesome remotos. Se prueban delegaciones de acciones, no una visita QR real ni una recompensa. Backend no modificado.

En la nueva Preview pública revisar categorías y lugares. En /admin.html entrar en Apariencia y Marca, revisar los campos y cambiar encuadre/estilo en el formulario; la vista previa de fotos funciona sin publicar. Abrir Buscador de portada, accesos rápidos y textos de tarjetas en sus módulos para comprobar que los controles aparecen. No pulsar Publicar configuración o Publicar contenido para una prueba sobre Firebase real sin autorizar esa edición.

Quedan pendientes publicación real autorizada de estas opciones y revisión del propietario con fotografías guardadas. Después continuar el diseño de las siguientes secciones. Los pendientes V74–V76 mantienen su documentación.
