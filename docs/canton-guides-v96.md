# V96 — Guías turísticas y gestión de cantones

## Uso del panel

Administración → Cantones permite:

- Revisar los 16 cantones: paradas asignadas, temas completos, portada y descripción pendientes.
- Editar seis temas: historia, cultura y tradiciones, gastronomía, clima y qué llevar, festividades y cómo llegar. Solo los temas completos se muestran al visitante.
- Seleccionar hasta 16 lugares destacados, ordenarlos y reutilizar una foto de una parada como portada del cantón. Revisar crédito antes de publicar.
- Configurar hasta ocho rutas, con nombre, duración orientativa, recomendaciones y de dos a doce paradas ordenadas. Una ruta solo aparece cuando todos sus lugares siguen publicados en el mismo cantón.
- Configurar título SEO, descripción e imagen para compartir. La portada se usa como imagen si no se configura otra.
- Guardar y recuperar un borrador de presentación, guía, destacados, rutas y SEO por cuenta/cantón en este navegador. No es un borrador privado remoto ni se sincroniza entre dispositivos.
- Previsualizar texto, foto, destacados y rutas sin publicar. Guardar y publicar guía conserva el control de versión transaccional.
- Revisar fotos, descripciones y coordenadas pendientes; editar cada lugar con el formulario existente.

## Página pública

Los enlaces `/canton/<id>` tienen metadatos de SEO y redes, canonical, datos estructurados, guía y lugares en HTML servido antes de JavaScript. Reutilizan categoria-seo: no se añade ninguna función Vercel. Cantones vacíos permanecen navegables, pero llevan noindex. Sitemap incluye guías con contenido y cantones con lugares públicos.

La página mantiene buscador, filtros, galería y contadores. Destacados aparecen primero. Guía por temas, rutas completas y mapa son adicionales. El mapa carga Leaflet 1.9.4 y OpenStreetMap solo al pulsar Cargar mapa, utiliza coordenadas válidas de lugares públicos y ofrece enlaces a Google Maps. Los enlaces Cómo llegar permanecen disponibles si falla el mapa. La duración y los textos de rutas son editoriales, no cálculos de navegación.

No se duplican paradas, fotos ni programas de fidelidad. No se inventan datos históricos, climáticos, festividades, rutas o imágenes de cada cantón: el administrador debe completarlos. No se crean roles de gestores cantonales en esta etapa.

## Datos y compatibilidad

Se amplía siteContent/canton_<id> con history, culture, gastronomy, climate, festivals, arrival, seoTitle, seoDescription, seoImage, featuredIds y routes. La ausencia de campos conserva el comportamiento de versiones previas. Se reutilizan las reglas existentes: lectura pública y escritura de administradores.

Borradores mediante el módulo existente admin-content-drafts, scope canton:<id>, sin escritura a Firestore. Vistas previas locales. El panel limpia información al cambiar de sesión/cantón; la publicación exige lectura previa y versión vigente. Campos de texto y URLs se sanitizan, y las consultas públicas mantienen filtros por cantón, actividad y publicación.

## Verificación

54 pruebas con DOM, Firestore y red simulados; validador estático y diff limpios. Cubre rutas incompletas, mapas sin coordenadas, datos inseguros, SEO servido, sitemap, borradores por cuenta, cambios concurrentes y subidas de imágenes. Revisión visual y guardado real pendientes. Publicación solo Preview; no se cambian main, reglas, funciones Firebase, variables o datos reales.
