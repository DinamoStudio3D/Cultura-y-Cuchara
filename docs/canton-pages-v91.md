# V91 — Presentación visual y administración de cantones

## Uso

Panel de Administración → Cantones → seleccionar cantón.

- Editar frase, URL HTTPS de portada, crédito, descripción y consejos. Guardar presentación publica esos textos en las páginas de cantones.
- Ver todas las paradas del cantón, incluidas las no publicadas, y pulsar Editar para abrir su formulario existente.
- Revisar Paradas sin cantón asignado y editar su asignación.
- Crear paradas desde Paradas y negocios. En el formulario elegir Cantón y guardar; la página pública muestra las paradas activas y publicadas con esa asignación.

No se duplicó el editor de paradas. Las fotografías de cada lugar proceden de su galería existente; las fotos de portada de cada cantón se configuran por URL. No se inventaron fotografías o descripciones de los cantones sin contenido.

## Diseño

Portada fotográfica con Puerta de la Ciudad de Loja, crédito de dominio público, llamada a escoger destino, tarjetas con composición gráfica y número de cantón. La presentación administrativa sustituye la composición por una fotografía y una frase cuando se configura. La ficha incluye portada, descripción, consejos y tarjetas de lugares con sus fotos. Diseño adaptable y movimiento reducido.

## Datos y seguridad

Un documento `siteContent/canton_<id>` por cantón: tagline, cover, coverCredit, description, highlights, version, cantonId, updatedBy, updatedAt. Reutiliza las reglas existentes de siteContent: lectura pública y escritura exclusiva de administradores. Guarda con transacción y versión para detectar modificaciones concurrentes. Fallos de carga bloquean el formulario; cambios sin guardar usan la protección existente del panel. Cambios de sesión limpian el contenido. Abrir el módulo no escribe datos.

Las consultas públicas de locales usan cantonId exacto y mantienen filtros de publicación, actividad y moteles. Se escapan textos y atributos, y se rechazan imágenes con protocolos inseguros. Una falla en la presentación no impide consultar lugares.

## Verificación

13 pruebas específicas de cantones, dos pruebas de seguridad administrativa existentes y validación estática. DOM y Firestore simulados; revisión visual, sesión administrativa y guardar contra Firebase real pendientes. Publicación en Preview. No se modifican main, reglas o funciones ni se guardan datos reales durante la implementación.
