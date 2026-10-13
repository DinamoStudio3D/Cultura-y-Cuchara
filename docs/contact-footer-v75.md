# V75 — Contacto, redes y pie de página

Base: V74 a250af6, exclusivamente design/modernizacion-web-v1.

## Resultado

El correo y los textos bilingües de contacto ya existían. Se conserva un único control de correo y se agrupan con WhatsApp, YouTube, TikTok, Instagram y Facebook en «Contacto y redes sociales» dentro del editor de portada. Dejar una red vacía la oculta; solo se aceptan URLs HTTPS sin credenciales. Los valores existentes se mantienen mientras no se publiquen cambios. También se administra el texto final del pie en español e inglés. Se conservan crédito de desarrollo, enlaces legales, instalación de la app y créditos fotográficos.

El formulario reutiliza la publicación y escucha de configuración existentes: no requiere otro despliegue para actualizar contenido publicado. «Descartar cambios» recupera la configuración cargada. No se implementan borradores persistentes en esta fase. Publicar este formulario sigue publicando el conjunto de bloques de portada; los módulos con formularios propios mantienen su flujo.

## Verificación

- Validadores de sitio e imágenes: correctos.
- 22/22 pruebas de contenido, multimedia, seguridad, colores, instalación y caché.
- Navegador aislado a 320, 390, 768 y 1440 px: edición, enlace inválido sin escritura, descarte, publicación simulada, correo único, ocultar/restaurar red y ausencia de desbordamiento horizontal del pie.
- Se mantiene la regresión multimedia V74 en la misma prueba de navegador.
- Firebase y proveedores simulados: cero escrituras reales. Iconos de fuentes y logo remoto no se cargan en esta prueba aislada; no se certifica su disponibilidad externa. Las capturas largas pueden incorporar el encabezado sticky según la posición de scroll. La comprobación pública usa el HTML real del pie y el script compartido, no acredita render completo del resto de la portada ni existencia de cada perfil social.

## Revisión del propietario

Abrir la Preview /admin.html, iniciar sesión con la cuenta propia y entrar en Contenido de la web, editor Contenido de la portada. Abrir Contacto y redes sociales y Texto del pie de página. Revisar correo único, enlaces, español/inglés y vistas previas. Editar sin publicar y pulsar Descartar cambios para comprobar la recuperación.

La Preview comparte Firebase real. No pulsar Publicar para una prueba sin autorizar la modificación de esos contenidos públicos. Para comprobar publicación real y actualización en la web se necesita configuración aislada o una edición real expresamente autorizada. No se cambiaron configuración, reglas, datos reales, main ni producción.

## Continuidad V74

El propietario confirmó en la conversación que puede subir fotografías y reproducir audios ES/EN con su sesión. No se observaron directamente esas operaciones. Cancelación real, restricciones efectivas del proveedor y eliminación real continúan documentadas como pendientes en multimedia-audit-v74.md.
