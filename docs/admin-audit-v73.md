# Auditoría del administrador — V73

Fecha: 10 de octubre de 2026 UTC. Base verificada: `191cd1202f4949fc4dcd47bb31f9c69951a64194`, rama `design/modernizacion-web-v1`, repositorio `DinamoStudio3D/Cultura-y-Cuchara`. Proyecto Vercel confirmado: `visita.loja`, `prj_ILNavXDm82MDUxPylwZU5ZKD1gxV`. Preview V72 confirmada READY y sin target de producción.

## Alcance y límites

Auditoría de código, formularios, fuentes de datos, listeners y APIs. No se inició sesión administrativa ni se escribieron datos reales. Este informe no acredita funcionamiento real de subidas, permisos desplegados, publicación o apariencia en navegador. Las reglas locales no prueban cuáles están instaladas en Firebase. Los documentos V67–V72 aportan antecedentes; se contrastaron los editores y referencias actuales.

## Inventario por módulo

| Sección | Ya administrable / fuente | Pendiente o límite detectado |
| --- | --- | --- |
| Principal y portada móvil | `settings/main`: identidad, títulos ES/EN, carrusel y encuadre, vídeo, música, apariencia; `homepageContent`: bienvenida, fotos editoriales, botones, contacto, textos ES/EN y visibilidad selectiva | Orden global, navegación y mensajes auxiliares permanecen en código. Móvil comparte carrusel con escritorio. No crear otro editor duplicado. |
| Gastronomía, hoteles y establecimientos | `locales`: ficha, traducciones, galería, coordenadas, categoría, horarios, perfil, plan y estado publicado/borrador/oculto; editor de presentación junto al módulo | Algunas etiquetas y filtros son código. Ficha publicada/borrador debe probarse con cuenta real. |
| Categorías | Gestión existente dentro de configuración/paradas; editor de encabezados | IDs de categorías también son usados por pasaporte y rutas: una taxonomía libre requiere revisar compatibilidad antes de cambiarla. |
| Atractivos, rutas y mapa | Atractivos como paradas; coordenadas, configuración de visita y textos de mapa editables | Generador de rutas y reglas de selección en `index.html`. No se identificó un módulo CRUD independiente de itinerarios editoriales. |
| Agenda y FIAVL | `siteContent/events`, `festival`, `tourismDay`, `customCampaigns`: eventos/campañas; textos FIAVL y cuatro tarjetas en editor Eventos | Afiches usan firma Cloudinary con preset. Algunos mensajes y destinos de acciones siguen siendo código. Prueba de vencimiento y subida real pendiente. |
| Pasaporte y fidelización | `siteContent/passport`, PIN privados y herramientas existentes; presentación ES/EN; gestión fidelidad en página propia accesible desde menú | Flujo repartido entre panel y gestión dedicada. Se detectó migración automática de PIN al cargar; V73 elimina su invocación, conserva datos y función sin ejecutarla. Recompensas y QR sin cambios. |
| Chabaquito y misiones | `siteContent/chabaquito`, `chabaquitoMissions`, campañas, comerciantes y canjes; borradores de misión y presentación dinámica | Conviven misiones/acciones antiguas y V2. No unificar sin comprobar compatibilidad. Algunas frases del personaje y acciones siguen en código. |
| Loja en el Tiempo | `loja_tiempo`: textos ES/EN, fotos antes/después por URL, coordenadas y audios ES/EN; subida firmada Cloudinary V72, reproductores y presentación | Fotos históricas aún se introducen por URL. No hay borrador persistido separado: Guardar punto publica. Quitar audio retira referencia, no elimina archivo remoto. V73 cancela cargas explícitamente y evita sembrado automático al abrir una colección vacía. |
| Postales y galerías | `settings/postcards`, `postcard_frames`; presentación ES/EN; galerías de fichas | Revisar UX de cargas por módulo; no asumir que todos los campos URL tienen selector. Verificar enlaces remotos desde centro de revisión. |
| Podcast y multimedia | `siteContent/podcast`: audio URL, portada, título, duración, descripción y visibilidad; presentación ES/EN | El formulario de podcast administra una muestra, no una biblioteca completa de episodios. No duplicar subidas históricas como podcast. |
| Publicidad y banners | Popup promocional en `settings/main`, patrocinadores, aliados, planes y campañas existentes | No se identificó un gestor único de inventario de anuncios con ubicaciones/programación por banner. Definir alcance antes de ampliar. |
| ILE | Encabezado editorial con foto y tres tarjetas de ingredientes ES/EN y visibilidad en editor existente | Las tarjetas ya son editables: documentación inicial de V67 quedó superada por V68. Estructura y acciones siguen en código. |
| Contacto, redes y pie | Correo y presentación del contacto editables; patrocinio institucional; contactos/redes de cada negocio | No se encontró editor específico de redes globales/navegación del pie. Separar redes del sitio de redes de fichas al implementarlo. |
| SEO y configuración | Metadatos dinámicos en `api/parada.js`, `categoria-seo.js`, `sitemap.js`; apariencia y mantenimiento en panel | Metadatos generales/plantillas SEO siguen en código. Un editor SEO debe servir HTML rastreable, no solo cambiar etiquetas después de cargar JS. |

Los editores `js/homepage-editor.js` y `js/homepage-content.js` ya publican bloques parciales de `settings/main` y conservan otros campos. Los listeners aplican contenidos sin nuevo despliegue. Vista previa local no equivale a borrador persistido. No añadir un botón de borrador que en realidad publique.

## Archivos, seguridad y permisos

- Cloudinary: firmas existentes para afiches, portada, comerciantes y audio. `sign-time-audio` fija carpeta y omite preset de imagen; frontend audio limita 20 MB y formatos. El límite del navegador no constituye una política del proveedor. Debe verificarse configuración Cloudinary antes de afirmar límite servidor o restricciones reales.
- Firebase: firma verifica cuenta mediante Identity Toolkit y admite propietario legado, claims admin/owner o `adminUsers` activo. Auditoría de revocación debe comparar claims con perfil y reglas desplegadas antes de cambiar permisos.
- Storage local permite audioguías a administradores por claims/correo; no usa la misma comprobación de `adminUsers` que la firma. Reglas finales niegan otros destinos salvo imágenes de comerciantes autorizados. No desplegadas por esta fase.
- Eliminación Cloudinary disponible para imágenes de comerciantes mediante API dedicada. No reutilizarla para portada/afiches/audio: propósito y pertenencia distintos. Eliminar una referencia no borra remotamente y puede dejar archivos huérfanos; borrado remoto general requiere inventario de referencias y protección contra recursos compartidos.
- API antigua `upload-admin-audio` escribía archivos en `main` mediante `GITHUB_AUDIO_TOKEN`. No se encontraron llamadas en el cliente actual. V73 conserva URL como respuesta 410, sin red ni commits. Método distinto de POST: 405.
- Cargar paradas invocaba migración que copiaba PIN y eliminaba campo antiguo. V73 retira llamada automática; no modifica QR, PIN guardados, canjes ni lógica de validación.
- Colección histórica vacía provocaba escritura de todos los puntos predeterminados. V73 elimina esa escritura implícita. La carga del panel muestra el estado existente, incluso vacío.

## Prioridad de siguientes fases

1. Comprobar subida ES/EN y fotos con cuenta administrativa, sin publicar cambios reales de prueba sin autorización. Reproducir archivo, reemplazar referencia, cancelar, guardar y comprobar lectura pública cuando se autorice un registro de prueba.
2. Mejorar carga de fotos históricas reutilizando firma y compresión con propósito propio; validar enlaces y permisos. Diseñar limpieza remota con inventario de referencias antes de borrar recursos.
3. Revisar otras escrituras de inicialización/mantenimiento al iniciar sesión, claims revocados y manejo de errores. Distinguir lectura de operaciones de mantenimiento explícitas.
4. Redes globales y metadatos generales; borradores persistidos y publicación por módulos. Mantener controles actuales como única autoridad.
5. QA visual real escritorio/móvil de módulos y páginas públicas; contraste, encuadre, overlays y espacios. Los tests de contratos de color no sustituyen inspección visual.

## Verificación V73

- `node scripts/validate-site.mjs`: validación completa sin errores.
- `node --test scripts/test-admin-safety.mjs scripts/test-time-audio.mjs scripts/test-homepage-content.mjs scripts/test-public-colors.mjs scripts/test-app-install.mjs scripts/test-public-cache.mjs`: 15/15.
- `npm test --prefix functions`: 77/77 (visitas, GPS, progreso, reconciliación y ranking).
- Test nuevo: ruta antigua nunca llama red aunque reciba credenciales/configuración; 410/405 sin commit.
- Test nuevo de interfaz simulada: español/inglés tienen cancelar; guardar se bloquea durante carga; cancelar conserva audio anterior y desbloquea guardar.
- Sin pruebas con sesión real, sin borrado remoto, sin migraciones, sin cambios a reglas desplegadas o producción.
