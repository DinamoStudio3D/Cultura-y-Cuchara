# Edición de contenido público — V67

## Panel

En **Apariencia y Marca → Contenido de la portada**, el administrador puede editar y publicar:

- Portada móvil: título y descripción en español e inglés, visibilidad.
- Tu próxima experiencia: foto, descripción accesible, crédito, textos y etiqueta en ambos idiomas, dos botones y sus destinos, visibilidad.
- Hecho en Loja: foto, descripción accesible, crédito, textos y etiqueta en ambos idiomas, botón y destino, visibilidad del encabezado editorial.
- Secretos de Cocina con ILE: foto, descripción accesible, crédito, título, descripción y etiqueta en ambos idiomas, visibilidad del encabezado editorial.
- Correo de contacto del pie de página.

La vista previa es local y **Publicar contenido de portada** guarda únicamente `homepageContent` en `settings/main`, mediante `merge:true`. No sobrescribe carrusel, negocios, campañas, misiones ni configuración de pasaporte. El formulario general existente ahora incorpora título y descripción de escritorio en inglés. Cambiar estos datos no requiere despliegue. El listener público de `settings/main` aplica los cambios en una página abierta.

Las fotos pueden subirse desde el dispositivo (JPG, PNG, WebP, hasta 15 MB), sustituirse mediante URL HTTPS o retirarse. Retirar una foto muestra el marcador neutro. Se reutilizan la compresión y la subida firmada de Cloudinary existentes, con un endpoint exclusivo `api/sign-homepage-image` y carpeta fija `visitaloja/homepage`. Los permisos de administrador y las reglas de Firestore no cambian. Subir un archivo no publica la portada: debe pulsarse Publicar. Quitar una foto de la portada no borra el archivo del proveedor.

## Auditoría y alcance

| Área | Administración existente | Pendiente después de V67 |
| --- | --- | --- |
| Carrusel, logotipo, vídeo, música y patrocinadores | Apariencia y Marca | Algunos mensajes auxiliares y navegación |
| Encabezados editoriales del rediseño | Editor V67 | Orden global de secciones y otros encabezados |
| Negocios, categorías y emprendimientos | Módulos Paradas y Emprendedores | Algunas introducciones estáticas |
| Eventos, FIAVL y campañas | Eventos y Centro de campañas | Algunos textos de presentación |
| Pasaporte, beneficios y misiones | Pasaporte y premios; Misiones Chabaquito | Algunas etiquetas y explicaciones visuales |
| Postales, historias, comparación histórica y podcast | Módulos existentes | Algunos encabezados y llamadas de interfaz |
| Tarjetas de ingredientes ILE | Código | Edición de las tres tarjetas |
| SEO y estructura global | Código/SEO dinámico de fichas | Editor de metadatos generales y orden global |

No se afirma que toda la página sea editable. La seguridad, autenticación, QR y lógica de rutas permanecen fuera del editor. La verificación de publicación, rechazo de permisos y carga de imágenes se realiza con un almacén aislado: no se escriben datos de prueba en Firestore ni en Cloudinary reales. La subida real depende de las variables Cloudinary existentes y de una sesión de administrador.
