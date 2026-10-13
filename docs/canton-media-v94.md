# V94 — Subida directa de fotografías

Administración → Cantones: elegir una imagen en Subir portada desde tu computadora y pulsar Subir portada. Tras revisar la miniatura, Guardar presentación publica la URL.

Editar parada → Fotografías: seleccionar hasta diez imágenes y pulsar Subir fotografías. Se optimizan y suben en secuencia, añadiendo sus URLs al campo de galería existente. La primera imagen sigue siendo portada y puede cambiarse con los controles V93. Guardar parada persiste la galería.

Acepta JPG, PNG y WebP, hasta 20 MB por archivo. Reutiliza compresor, uploader firmado de Cloudinary y guardia multimedia existentes. La API existente sign-time-image acepta purpose=time, canton o gallery, reutiliza comprobación administrativa en servidor y fija carpetas independientes. Destinos no permitidos se rechazan. No se añaden funciones para mantener el límite del plan Hobby. No reciben carpeta arbitraria ni revelan secretos. Requieren las variables Cloudinary existentes en el despliegue.

El guardado queda bloqueado durante la subida. Cancelar, cambiar de módulo, editar otra parada, reiniciar formulario o cambiar cantón/sesión aborta la tarea; una respuesta tardía no escribe en otra ficha. Errores parciales conservan fotos ya añadidas al borrador. No se guardan documentos automáticamente ni se eliminan imágenes remotas.

34 pruebas con DOM, API y red simulados y validador estático aprobados antes de publicación. Revisión visual y subida real con sesión administrativa pendientes. No se cambiaron variables de entorno ni Firebase. Publicación solo Preview.
