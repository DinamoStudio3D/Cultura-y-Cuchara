# V76 — Borradores de contenido en este dispositivo

Base: V75 1cf8891; rama exclusiva design/modernizacion-web-v1.

## Alcance y decisión

La regla de settings permite lectura pública. No se escribieron borradores allí ni se desplegaron nuevas reglas privadas. El editor ofrece Guardar borrador en este dispositivo y Recuperar borrador, separados de Publicar. Se reutilizan los editores de portada y presentación de módulos: categorías/paradas, agenda/FIAVL, postales, Loja en el Tiempo, podcast, ILE, pasaporte y misiones. Solo afecta textos/bloques editoriales; no crea borradores de eventos, negocios, puntos históricos, recompensas o reglas QR.

Los borradores se guardan por UID y formulario en localStorage del origen de la Preview. Guardar/recuperar no llama Firestore ni publica la web. Recuperar reemplaza el formulario y exige revisar antes de publicar; Descartar cambios vuelve al contenido publicado, conservando el borrador. Publicar mantiene la validación existente y no elimina el borrador local. Se rechazan registros corruptos, otra cuenta/formulario y exceso de tamaño; un fallo al guardar no sustituye un borrador anterior. Los campos restaurados se limitan al esquema del editor.

## Límites

No hay sincronización entre dispositivos, navegadores ni distintas URLs de Preview. Borrar los datos del navegador elimina el borrador. La separación por cuenta es de aplicación, no un almacén cifrado frente a otros programas o usuarios con acceso al mismo navegador. No guardar información confidencial. Se conservan URLs de fotos ya subidas, no archivos seleccionados todavía pendientes. Subir una foto sigue creando un recurso real en Cloudinary, aunque solo se guarde como borrador. No se implementó borrado automático de recursos.

## Pruebas

- Validadores de sitio e imágenes correctos; sintaxis JavaScript correcta.
- 24/24 tests de borradores, contenido, multimedia, seguridad, colores, instalación y caché.
- Navegador con DOM real y proveedores simulados a 320/390/768/1440 px: guardar, recargar, recuperar, descartar, separación por cuenta, cero escrituras Firestore para borrador; mantiene pruebas multimedia V74 y contacto V75.
- QuotaExceeded, tamaño excesivo, JSON corrupto y UID incompatible: errores explícitos; conservación del borrador previo.
- No se comprobaron permisos Firebase nuevos: no se requieren para almacenamiento local. No hubo datos reales, cambios de main, reglas de producción ni merges.

## Revisión con cuenta propia

Abrir la Preview del administrador y entrar en Contenido de la web. Editar un texto, pulsar Guardar borrador en este dispositivo, recargar, volver al mismo editor y pulsar Recuperar borrador. Verificar el texto y pulsar Descartar cambios; la web pública permanece intacta. No subir archivos ni pulsar Publicar durante esta prueba. El login conserva las operaciones de auditoría ya existentes.

## Pendiente

Borradores privados compartidos en la nube necesitan una colección con acceso administrativo y pruebas de reglas antes de autorizar su despliegue. Publicar desde un borrador sobre los datos reales sigue requiriendo una edición autorizada por el propietario. Pruebas reales V74 pendientes siguen documentadas en multimedia-audit-v74.md.
