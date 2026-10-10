# V77 — Composición visual de la portada

Base: V76 e933a10, rama design/modernizacion-web-v1.

## Cambio visible

En escritorio la fotografía ocupa el fondo completo de la bienvenida, con texto a la izquierda sobre una protección oscura, búsqueda en tarjeta clara y mensaje/recomendaciones a la derecha. El panel de acciones usa botones delimitados. Los accesos inferiores pasan de una barra compartida a tarjetas independientes.

En móvil se mantiene la secuencia foto → bienvenida → búsqueda → categorías y acciones. El texto de bienvenida tiene una superficie oscura para conservar contraste con cualquier fotografía, crece con textos largos y no tapa la búsqueda. Los cuatro accesos inferiores quedan disponibles, incluido Chabaquito. Se mantienen contenidos bilingües editables, IDs, acciones, enlaces, carrusel y posición de fotografía configurados existentes. No se modificaron datos ni funciones de QR, pasaporte, misiones, mapas o recompensas.

Solo se enlaza una hoja CSS nueva a index.html. El CSS se limita a la bienvenida y sus accesos, sin cambiar el administrador ni el resto de secciones. No se reemplazan las fotografías configuradas ni los textos guardados.

## Verificación

- Navegador aislado: 320, 390, 768, 1024 y 1440 px. Sin desbordamiento horizontal ni errores JavaScript; acciones visibles de al menos 44 px de altura.
- Búsqueda: función real searchFromWelcome/runSmartSearch transferida desde index.html: conserva el texto recortado, lleva al campo de resultados y llama al buscador. La dependencia de resultados se simula; no se acredita búsqueda completa contra negocios reales.
- Contenido administrable: script compartido real aplica título/subtítulo de escritorio y título/descripcion móvil. Textos largos hacen crecer la composición sin ocultar la búsqueda.
- 24/24 tests de contenido, borradores, multimedia, seguridad, colores, instalación y caché.
- Validadores de sitio e imágenes correctos; git diff --check correcto.

## Capturas y límites

[Vista móvil](v77/welcome-mobile.webp) · [Vista escritorio](v77/welcome-desktop.webp) · [Resultados](v77/browser-report.json).

Se utiliza el HTML real de navegación y bienvenida con CSS local y scripts delimitados. El resto de la aplicación, Firebase y mapas no se ejecutan. Los proveedores remotos de foto y logo respondieron HTTP 429 al intentar consultarlos desde este entorno; el test los sustituye por la foto Puerta de la Ciudad ya incluida en el repositorio. Los iconos de Font Awesome no se cargan en esta prueba. Las capturas demuestran composición y textos, no disponibilidad de esos proveedores ni el encuadre de las fotografías guardadas en Firebase. El crédito de esa foto permanece en el repositorio/pie original.

No se inició sesión ni se crearon datos o recursos reales. Se requiere revisar la Preview en el navegador propio para confirmar las imágenes y fuentes reales, el carrusel configurado y los diálogos de mapa, recorrido y recomendaciones en funcionamiento completo. La composición depende de los textos y encuadre guardados: no se cambiaron para fabricar una captura.

## Reproducción

Con Playwright, Chromium y Tailwind local compilado incluyendo index.html:

`VISITALOJA_QA_BROWSER=<ruta-a-chromium> node scripts/test-welcome-browser.cjs`

El CSS de Tailwind se lee de /tmp/visitaloja-tailwind.css. Salida configurable con VISITALOJA_QA_OUTPUT.

## Pendiente

Revisión del propietario de esta dirección visual en la Preview; después continuar tarjetas de categorías/lugares y revisión global de la web. Los pendientes de proveedores multimedia, borradores en nube y publicación real continúan en los informes V74–V76. No se modificó main ni se desplegó producción.
