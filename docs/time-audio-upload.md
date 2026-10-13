# Loja en el Tiempo: subida de narraciones — V72

El formulario solo ofrecía rutas manuales; no tenía selector ni implementación de subida. Ahora cada idioma dispone de selector, Subir audio, progreso, reproducción y Quitar audio. Admite MP3, M4A, WAV, OGG, AAC, FLAC, Opus y WebM hasta 20 MB. La URL solo se publica al pulsar Guardar punto. Quitar retira la referencia; no borra el archivo remoto.

La autorización usa Firebase y los mismos permisos administrativos que los afiches. `/api/sign-time-audio` firma exclusivamente la carpeta `visitaloja/time/audio`, sin reutilizar presets de imágenes. Cloudinary recibe el archivo directamente mediante su endpoint `video/upload`, que también admite audio. No se escribe en GitHub, main ni Firebase Storage. Requiere las variables Cloudinary existentes de cloud name, API key y secret; se confirmó su presencia en Preview sin leer valores secretos.

No se permite guardar mientras hay una carga pendiente. Cambiar de punto, cancelar la edición o quitar un audio cancela la carga y evita asignar su resultado a otro lugar. Los errores y límites se muestran junto al idioma correspondiente. Se conserva la entrada manual de URLs y la narración automática cuando no hay archivo.

Verificación: tests de autorización (anónimo, cuenta desactivada, no administrador, administrador activo), firma y destino fijo sin filtrar secretos; pruebas de interfaz con proveedores simulados en 320/390/768/1440 px, metadatos reproducibles, español/inglés, payload guardado, errores, cancelación y rechazo de archivos. La publicación y subida con una sesión real del propietario siguen pendientes.

Referencias técnicas: https://cloudinary.com/documentation/upload_parameters y https://cloudinary.com/documentation/image_upload_api_reference (audio como resource_type video; presets opcionales en subida firmada).
