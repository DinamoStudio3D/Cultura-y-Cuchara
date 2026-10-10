# V74 — Auditoría y verificación multimedia

Base: V73 `50c4de6de5c2267bd6fd2fbc7d7fcad68254cd8a`, rama `design/modernizacion-web-v1`. Repositorio y rama verificados antes de editar; checkout inicialmente limpio. No se ejecutaron escrituras reales en Firebase, cargas o borrados reales en Cloudinary, cambios en main, merges, migraciones, modificaciones de reglas desplegadas ni despliegues de producción.

## Cambios comprobados

1. `validate-image-pipeline.mjs`: el orden guardado → limpieza se comprueba en el portal que llama al helper; la llamada autenticada se comprueba en el helper; la pertenencia a carpeta/parada/propósito se comprueba en la API. Ya no se exige encontrar en el HTML una URL que reside en el helper ni una regla de carpeta que reside en el servidor. Además de estas comprobaciones estáticas, los tests de API y navegador verifican comportamiento.
2. Subida compartida de imágenes: cancelación mediante AbortSignal, límite de espera de 120 segundos, errores HTTP/proveedor, rechazo de respuestas de otro host, cuenta, carpeta o tipo de recurso; archivos vacíos rechazados antes de decodificar. No se solicita overwrite de la imagen anterior ni se la elimina durante la carga.
3. Loja en el Tiempo: selector y subida separados para foto antigua y actual, vista previa con `object-fit:contain`, firma dedicada `/api/sign-time-image`, carpeta `visitaloja/time/images`; se reutilizan el compresor y el preset de imágenes existente. Guardar punto publica, subir solamente cambia el formulario. Cancela al cambiar de punto, reiniciar, salir del módulo o cerrar sesión.
4. Afiches: los controles existentes llaman al nuevo coordinador de imágenes. Cancelación explícita, bloqueo de guardar, respeto del límite anunciado de 5 MB y protección frente a respuesta tardía después de editar otro evento. No se añadieron controles duplicados.
5. Portada: cancelar, quitar y descartar interrumpen la carga; una respuesta tardía no reemplaza la fotografía descartada. Firma y compresión usan el flujo existente. Publicar continúa como acción independiente.
6. Audios ES/EN: conviven con las imágenes mediante un bloqueo común del formulario; cancelar uno no habilita guardar si otro sigue cargando. Campos bloqueados durante carga, carpeta/cuenta de respuesta verificadas, mensaje al iniciar transferencia aunque todavía no haya porcentaje y aviso si el navegador no puede reproducir el archivo. Mantiene narración automática y URLs antiguas.
7. Portal de comerciantes: bloquea campos y cambio de parada durante carga, permite cancelar antes de guardar, valida que el destino siga siendo el mismo y detiene la carga al cerrar sesión. Seleccionar archivo ya no vacía la URL anterior. Cancelar conserva esa URL y no solicita limpiar su archivo. Se liberan URLs temporales de vista previa. La cancelación deja de estar disponible al iniciar la escritura en Firestore: no se promete deshacer una escritura ya enviada.
8. Borrado de comerciantes: mantiene rol y pertenencia existentes, rechaza credenciales embebidas y URLs malformadas, normaliza URLs con versión/transformaciones y conserva un archivo aún referenciado por la parada. Si no puede leer la parada, falla sin borrar. Esta protección revisa el registro de esa parada; no acredita inventario global de referencias compartidas entre todos los módulos. No se añadió borrado remoto general para audios, portada o afiches.

## Inventario actual y límites del cliente

| Módulo | Flujo actual | Formatos / límite | Cancelar y conservar | Pendiente con proveedor real |
| --- | --- | --- | --- | --- |
| Fotos de Loja en el Tiempo | Firma Cloudinary nueva; fotos separadas antes/ahora | JPG, PNG, WebP / 20 MB de entrada; optimización a WebP, hasta 1600×1600 sin deformar | Sí; URL anterior intacta con error o cancelación | Subida y vista previa real con cuenta |
| Audios históricos ES/EN | Firma Cloudinary, endpoint `video/upload` | MP3, M4A, WAV, OGG, AAC, FLAC, Opus, WebM / 20 MB | Sí; solo Guardar publica; Quitar retira referencia, no archivo remoto | Subida, reproducción por formato y permisos reales |
| Afiches de agenda | Firma Cloudinary y preset existente | JPG, PNG, WebP / 5 MB de entrada | Sí; cambio de evento protegido | Restricciones efectivas del preset |
| Fotos editoriales de portada | Firma Cloudinary; Publicar independiente | JPG, PNG, WebP / 15 MB de entrada | Sí; cancelar/quitar/descartar protegidos | Subida y publicación reales |
| Logo, portada y galería de comerciante | Firma por parada/propósito; guardado antes de limpieza | JPG, PNG, WebP / 20 MB; galería limitada por plan existente | Sí; guardado fallido no limpia anteriores | Cuenta de comerciante, límites y limpieza real en entorno aislado |
| Paradas desde admin | Fotos/galería por URL | Validación existente del módulo | No se implementó selector universal en esta fase | Verificación de enlaces externos |
| Podcast | Muestra con audio y portada por URL | No se implementó biblioteca/subida de episodios | Referencias existentes conservadas | Disponibilidad y reproducción de URLs |
| Postales y marcos | Configuración por URLs, generador existente | No se implementó nuevo cargador | Configuración existente conservada | Disponibilidad de recursos |
| Carrusel, vídeo, música, campañas y otras imágenes | Configuración/URLs existentes | Dependientes del recurso y de su módulo | Sin migrar ni eliminar recursos | Reproducción, permisos y recursos externos |

Son límites del navegador, no una certificación de políticas de Cloudinary. Una firma no convierte la validación del cliente en una restricción del proveedor. No se leyó el API secret ni se cambiaron presets/variables/reglas reales. Compatibilidad de decodificación de cada formato de audio depende del navegador y códec; aceptar la extensión no garantiza reproducción universal. La prueba de reproducción usó WAV válido en ambos idiomas.

## Pruebas técnicas realizadas

- `node scripts/validate-image-pipeline.mjs`: OK, incluidos los dos validadores corregidos.
- `node scripts/validate-site.mjs`: sin errores.
- `node --test scripts/test-multimedia.mjs scripts/test-admin-safety.mjs scripts/test-time-audio.mjs scripts/test-homepage-content.mjs scripts/test-public-colors.mjs scripts/test-app-install.mjs scripts/test-public-cache.mjs`: **21/21**.
- `npm test --prefix functions`: **77/77**, reglas de visitas, GPS, misiones, reconciliación y ranking conservadas.
- `test-multimedia.mjs`: formatos, cero bytes, límite exacto/exceso, proporción, rechazo de respuestas ajenas, error 413, cancelación previa y timeout, bloqueo conjunto, carpeta firmada fija, anonimato/rol de borrado, carpeta ajena y conservación de referencia vigente incluso transformada; lectura fallida no borra.
- `test-multimedia-browser.cjs`: **320, 390, 768 y 1440 px**, DOM/scripts reales de admin y portal con Firebase/Cloudinary simulados. Ninguna conexión se deja pasar a servicios reales. Comprueba fotos, errores/corrupción, cancelación simultánea foto/audio, reproducción ES/EN, payload de guardado aislado, cambio de evento, permiso 403, cancelar/descartar portada, conservar comerciante al cancelar, no limpiar con guardado fallido y limpiar solo tras guardar con éxito. Cero errores de JavaScript en los cuatro tamaños.
- El fixture Firebase es exclusivo de tests: la web no lo carga. No se usó ninguna cuenta real ni token real. Los endpoints de firma se prueban por separado con proveedores inyectados.

## Revisión visual

Se inspeccionaron capturas de móvil/escritorio: controles legibles, imágenes con proporción conservada y campos/acciones históricos sin desbordamiento horizontal. Capturas con datos simulados y fotografía ya incluida en el repositorio; no son registros públicos creados para pruebas. El CSS de utilidades se compiló localmente con Tailwind 3.4.17 para que la prueba no dependiera de su CDN. El mapa externo se dejó inerte en este test, por lo que no se acredita su rendering real.

[Formulario móvil](v74/time-mobile.webp) · [Formulario escritorio](v74/time-desktop.webp) · [Resultados de navegador](v74/browser-report.json).

Las capturas largas de un elemento pueden incluir el encabezado sticky en su posición de scroll; son evidencia del formulario, no una fotografía de toda la pantalla ni una afirmación de ausencia de overlays en cada módulo de la web.

### Reproducción del test visual

Requiere Playwright, un Chromium ejecutable y CSS local compilado de los archivos usados. No necesita login:

```bash
node <ruta-a-tailwind-3>/lib/cli.js -i <archivo-con-directivas-tailwind> -o /tmp/visitaloja-tailwind.css --content './admin.html,./merchant-profile.html,./js/*.js,./css/*.css' --minify
VISITALOJA_QA_BROWSER=<ruta-absoluta-a-chromium> VISITALOJA_QA_CSS=/tmp/visitaloja-tailwind.css node scripts/test-multimedia-browser.cjs
```

El archivo de entrada contiene `@tailwind base; @tailwind components; @tailwind utilities;`. Salida por defecto: `/tmp/visitaloja-v74-qa`; se puede cambiar con `VISITALOJA_QA_OUTPUT`.

## Pruebas pendientes que requieren intervención del propietario

**La Preview no aísla los datos:** el proyecto Firebase y Cloudinary son los de la plataforma. Ingresar al panel puede registrar auditoría y ejecutar mantenimiento/cache existente. Una subida crea un archivo real aunque no se guarde el formulario. Por la instrucción de no afectar datos reales no se hicieron esas pruebas. No enviar contraseñas ni tokens en el chat.

### Para revisar controles sin publicar

1. Abrir la nueva Preview `/admin.html` en el navegador propio. Si se autoriza acceder al panel conectado al Firebase real, iniciar sesión con la cuenta administrativa habitual.
2. Ir a **Contenido de la web → Loja en el Tiempo** y editar un punto. Verificar los dos selectores de fotografía, los dos de audio ES/EN, las vistas previas y los límites indicados.
3. No pulsar **Guardar punto**, **Publicar**, **Eliminar** ni modificar configuraciones mientras se haga esta revisión. Para evitar también los registros automáticos de login, usar únicamente las capturas y el test aislado.

### Para confirmar la subida real — solo después de autorizar archivos de prueba o usar un proveedor aislado

1. En un punto abierto, seleccionar un MP3 corto en español y pulsar **Subir audio**. Esperar la confirmación, escuchar y comprobar que la URL es de Cloudinary. Repetir en inglés; comprobar que cambiar uno no modifica el otro.
2. Seleccionar una foto JPG/PNG/WebP válida menor de 20 MB en cada fotografía histórica; subir y revisar encuadre/proporción. En afiches usar menos de 5 MB y en portada menos de 15 MB.
3. Durante una segunda carga, pulsar **Cancelar subida**; comprobar que conserva la URL anterior y habilita guardar solo cuando no queda otra carga pendiente. Cambiar de punto o evento mientras carga y comprobar que no llega a asignarse al otro registro.
4. No guardar/publicar los puntos reales de esta comprobación. Volver a abrirlos: las referencias guardadas deben seguir siendo las anteriores. Subir puede dejar recursos no referenciados; no eliminarlos sin comprobar su uso.
5. Enviar el módulo, idioma, formato, tamaño y texto exacto de cualquier error; sin credenciales ni tokens.

### Publicación, permisos y eliminación real

Guardar y leer públicamente, revocar acceso, probar rol de comerciante, límites de galería y eliminar archivos requieren un entorno Firebase/Cloudinary aislado o autorización específica sobre datos de prueba. No realizarlos contra una parada real para completar esta fase. La eliminación física y las restricciones efectivas del proveedor siguen sin acreditarse.

V74 queda técnicamente verificada con servicios simulados y con estas comprobaciones reales documentadas. No se empezó V75.
