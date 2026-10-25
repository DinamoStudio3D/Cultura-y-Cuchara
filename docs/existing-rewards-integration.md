# Mejoras sobre el sistema existente

Base: main 4cd6f5c y cambios del PR67, sin importar la rama experimental feature/reward-configuration.

## Incluido

- Pasaporte con paradas únicas y aviso de próxima visita de fidelidad del PR67.
- Formulario actual de fidelidad: al seleccionar una parada carga su programa guardado, y al elegir una nueva limpia los datos de la anterior. El acceso directo desde editar una parada también carga el programa correcto.
- Resumen visual de meta, beneficio, condiciones, plazo de canje y cupos sobre los campos existentes; actualización de la tarjeta de ejemplo al cargar/editar.
- Formulario actual de pasaporte con selector Lojano/Turista y resumen de ambos premios y negocios de entrega.
- Validación de fechas, nombre del premio habilitado, negocio activo o enlace de entrega HTTPS. Fechas de campaña interpretadas en hora de Loja, conservando fechas legadas de solo día.
- Reparación de los fixtures desactualizados de sesión administrativa y referencia del archivo de acceso de negocios, para ejecutar las pruebas posteriormente.

Se conserva el guardado actual: loyaltyPrograms, siteContent/passport y missionRewardMerchants. No hay nuevas colecciones, proyectos, credenciales, endpoints ni reglas. Se mantienen las metas del pasaporte y los límites vigentes de fidelidad (10–30 sellos y 1–3 por día). No se modificó el Worker activo ni se fusionó main.

## Pendiente, sin simular funciones operativas

- Tarjetas de temporada con progreso separado y regreso a la habitual: deben adaptarse al contador, confirmación y cartera actuales de forma coordinada.
- Cambiar metas conservando las condiciones de tarjetas ya empezadas: necesita soporte en el servicio actual, no solo un formulario.
- Catálogo con elección entre varios premios de pasaporte: el sistema vigente guarda un premio por modalidad; requiere adaptar el canje antes de ofrecerlo como operativo.
- Pruebas funcionales completas, aplazadas por indicación del propietario. En esta etapa solo se comprobó sintaxis y formato.

El entorno vivelojapruebas queda apartado; no se usa como destino de estas mejoras.

## Implementación de temporadas sobre el contador actual

Se añadió una política compartida por el Worker, la función existente y la cartera. Cada programa puede contener hasta 24 temporadas sin solapamientos; la tarjeta seleccionada depende de fechas con zona horaria explícita. Se mantiene el rango vigente de 10–30 sellos y 1–3 por día.

El contador `loyaltyCounters/{usuario_parada}` conserva su progreso habitual y almacena el de cada temporada en `seasonalCards`. Sus campos diarios y último movimiento siguen siendo comunes. Los premios usan `loyaltyRewardClaims` con identificadores distintos por usuario/parada/temporada/ciclo. Su política se copia en el progreso al primer sello. Al finalizar vuelve a seleccionarse la habitual; las temporadas anteriores quedan consultables y los premios ya emitidos mantienen su plazo original.

Confirmación y anulación se adaptaron en el código de los servicios existentes. La anulación restaura la tarjeta correspondiente y no elimina un premio de temporada ya entregado. Una marca de uso en el programa impide cambiar o quitar condiciones de una temporada que ya recibió sellos; sus cupos pueden ajustarse sin bajar de los emitidos.

El editor se conecta al formulario existente, pero solo permite configurar temporadas cuando el servicio de sellado anuncia `loyaltySeasonPolicyVersion: 1`. Si el servicio activo todavía no ofrece esta capacidad, muestra «pendiente de habilitar» y mantiene deshabilitados esos controles. No publica una configuración que el servidor desconoce.

**No se ha desplegado el Worker ni la función.** Antes de aplicarlos hay que contrastar la versión activa con las fuentes del repositorio para conservar cualquier ajuste operativo que no esté sincronizado. No se ejecutaron pruebas funcionales; esta sección describe implementación pendiente de verificación, no una función activa en producción. La nueva Preview continúa usando el servicio actual sin habilitar temporadas prematuramente.


### Condiciones de la tarjeta habitual
El servicio conserva en `loyaltyCounters.permanentPolicy` los sellos, límite diario y beneficio de la tarjeta habitual al confirmar un sello. Las siguientes visitas y la cartera usan esas condiciones; la activación y los cupos siguen dependiendo de la configuración vigente. La anulación restaura la política anterior. No cambia los contadores ni beneficios de temporada.

Las tarjetas anteriores que todavía no tengan esta copia conservarán la configuración disponible en su próxima confirmación; no es posible reconstruir condiciones históricas que nunca se guardaron. No se realiza una migración de datos. Esta protección sigue pendiente de revisión del servicio desplegado, activación y pruebas funcionales.


### Opciones de recompensa del pasaporte
El panel existente permite añadir hasta nueve alternativas al premio principal por modalidad (diez en total). Cada alternativa tiene nombre, condiciones, estado y negocio autorizado de entrega. Se guarda un mapa `choices` dentro de `siteContent/passport.tourist` o `.local`; sin alternativas se conserva el flujo de premio único. Se reemplazan estos objetos completos al guardar para que una alternativa retirada no permanezca por una fusión de mapas.

El visitante elige una opción antes de registrar su premio. El mismo documento determinista por usuario/campaña/modalidad impide crear otra elección; el registro y el índice del código se escriben en un lote. El registro conserva `optionId`, `rewardSnapshot` y `merchantUid`. La verificación del negocio muestra el título elegido; las reglas restringen los canjes nuevos al negocio guardado y una entrega pendiente solo puede pasar una vez a entregada. Los canjes anteriores mantienen sus permisos anteriores. Un administrador conserva las facultades de corrección que ya existían. No se añade control de existencias por opción.

**Pendiente de publicación y pruebas:** los cambios en `firestore.rules` deben revisarse y publicarse antes de activar alternativas en una web desplegada. No se han publicado reglas ni modificado datos reales. La creación del canje se trasladó a la API autenticada descrita a continuación; ya no admite creaciones directas desde el cliente en las reglas preparadas. Pruebas funcionales aplazadas por petición del usuario.


### Validación del pasaporte en la API existente
`api/chabaquito-ranking.js?action=passport-claim` reutiliza la autenticación Firebase Admin y la credencial del proyecto actual; no agrega una función Vercel ni otra cuenta. `functions/passport-claim.js` consulta dentro de la transacción la campaña, perfil, sellos seguros, visitas confirmadas y categorías actuales de las paradas. Exige seis gastronómicas distintas para Lojano o un hotel y cinco gastronómicas distintas para Turista. Solo acepta sellos de la campaña solicitada con una visita confirmada del mismo usuario/parada; ignora el contador del navegador y no convierte progreso local antiguo en visitas verificadas. Los historiales sin prueba suficiente requieren revisión, sin inventar sellos.

La API comprueba las fechas y disponibilidad actual de la opción y del negocio. Genera un código aleatorio en servidor y crea registro e índice atómicamente; los reintentos recuperan el mismo premio. Marca las seis visitas con `passportClaimIds` en la misma transacción. El código preparado de Worker/callable y las reglas bloquean la anulación normal de esas visitas; el administrador conserva la revisión manual. La vista del pasaporte sincroniza los sellos de la campaña actual.

Las reglas preparadas deniegan toda creación directa de `passportCompletions` desde cliente y reservan la creación manual de índices al administrador. Deben publicarse de forma coordinada con la API y frontend, sin dejar funcionando el antiguo cliente de canjes. Las páginas históricas de preview que conservan el método antiguo fallarán de forma cerrada al publicar estas reglas; no se usan para probar este flujo.

Validación realizada: sintaxis JavaScript/HTML y revisión de diferencias. No se ejecutaron pruebas funcionales ni se publicaron reglas o servicios. Comparación del Worker activo: pendiente de acceso de lectura a Cloudflare; no se encontró conector y ambas consultas públicas `/health` recibieron HTTP 403 desde este entorno. Esto no demuestra un fallo del servicio para usuarios reales. No sustituir el Worker activo por el archivo del repositorio sin comparar su fuente.

### Orden de preparación para pruebas
1. Leer y comparar la versión activa de Cloudflare y conservar sus cambios operativos.
2. Preparar una versión aislada del mismo servicio con los cambios de temporadas y protección de canjes; verificar su origen y versión antes de conectar una preview. No promover ni reemplazar producción.
3. Revisar las reglas y la API en un entorno de prueba autorizado; no publicar reglas sobre producción como parte de esta preparación. La API usa la credencial existente de cultura-y-cuchara y no representa por sí sola un entorno aislado de datos.
4. Cuando el usuario autorice las pruebas funcionales: seis paradas distintas, duplicados, hotel en cada modo, campaña distinta, visita anulada, datos locales inventados, doble clic/concurrencia, elección inmutable, entrega por negocio correcto, segunda entrega rechazada, anulación tras canje, temporadas y retorno a habitual.


### Revisión de anulación y cupos
La anulación de un premio de temporada descuenta una unidad del total vigente dentro de la transacción. No restaura el total histórico de la visita, porque eso borraría del conteo los premios obtenidos después por otras personas. Un total ausente, fraccionario o inferior a uno requiere revisión en lugar de modificar cupos con datos inconsistentes. La respuesta de anulación de la tarjeta habitual usa los sellos de su política guardada.

Se preparó `scripts/test-existing-loyalty-policy.cjs` para comprobar progreso de temporada separado, límite diario compartido, conservación de otras temporadas al anular, retorno a habitual con beneficio anterior, descuento sobre el total vigente y rechazo de cupos inconsistentes. Solo se verificó la sintaxis del archivo; no se ejecutaron estos casos por el aplazamiento de pruebas. Comando para la etapa de pruebas: `node scripts/test-existing-loyalty-policy.cjs`. No conecta con Firebase.


### Sesiones y verificación de entregas
Las consultas del verificador conservan la identidad, versión de permisos y número de consulta que las inició. Una respuesta anterior no puede reemplazar el resultado de otra consulta o cuenta. Al cambiar cuenta o permisos se limpia el código y resultado visible; las respuestas de inventario también se descartan si ya no corresponden. La consulta exige que el código guardado coincida exactamente con el presentado y rechaza códigos de fidelidad que correspondan a más de un registro.

El negocio ve las condiciones guardadas en la elección del pasaporte y la fecha real de creación/completado. El formulario de canje del visitante descarta éxitos, errores y cambios de botón de una cuenta o modalidad anterior, e invalida consultas entre sesiones de la misma cuenta mediante la generación de acceso existente. Las reglas y transacciones siguen siendo la comprobación de autoridad.

Casos adicionales preparados para la etapa de pruebas: cambiar de cuenta durante consulta y canje; cerrar y volver a entrar con la misma cuenta; retirar permisos mientras llega una respuesta; dos búsquedas consecutivas con respuestas en orden inverso; código cuyo índice apunta a otro código; registros duplicados de fidelidad; condiciones y fecha del premio elegido visibles para el negocio. No se ejecutaron pruebas funcionales.


### Comparación cerrada con el código facilitado por el propietario
El 24 de octubre se recibió el código completo de la versión activa `4359a38e`, identificada en la captura del propietario. SHA-256 del texto recibido: `21808fcc9dbd7f8fcbb747dc6c336ebaf2393b02341b7a99beef20636f16650c` (968 líneas). Frente a main `4cd6f5c`, solo faltan los dos orígenes de producción y el soporte de misiones `unique_places`. La rama conserva esas incorporaciones. No hay cambios operativos adicionales en el código recibido que rescatar. Esta comparación sustituye el bloqueo anterior de lectura de fuente; no verifica secretos, enlaces o configuración de una preview aislada.

El código activo confirma visitas pero no crea sellos seguros de pasaporte ni premios de fidelidad. La rama integra ahora ambos en la transacción existente del Worker: sello determinista por campaña/usuario/parada, identificación del sello creado en la visita, premio habitual o de temporada según política, cuota diaria compartida, stock y ciclos actualizados con el premio. La respuesta informa `passportAdded` y `rewardCreated`. El programa ausente o inactivo no genera premio. La anulación retira solamente el sello creado por esa visita y su premio pendiente, restaura ciclos/progreso y descuenta del stock emitido vigente. Una visita que respalda un canje de pasaporte o un premio entregado requiere revisión administrativa. No cambia la lógica de misiones.

`/health` anuncia versiones de políticas de temporada, sello de pasaporte y premio de fidelidad. `scripts/build-chabaquito-worker.cjs` genera `workers/chabaquito/worker-preview.js` con la política compartida incluida, apto para el editor de un solo archivo de Cloudflare. Es código generado; editar los archivos fuente y regenerarlo. Se verificaron generación, sintaxis y diferencias; no se ejecutaron pruebas funcionales ni se publicó el archivo.

Pendiente para pruebas integradas: verificar el destino aislado de Cloudflare y conectarlo exclusivamente a la preview web; preparar las reglas de forma coordinada. El Worker y la API mantienen el proyecto existente y no equivalen a aislamiento de datos. No publicar en producción ni ejecutar visitas reales como prueba sin autorización.


### Preview 7c9e24b2 preservada
El propietario facilitó también el código completo de la preview (1011 líneas). Contiene validación de compra/cortesía/turismo y motivo obligatorio de anulación con auditoría. Se incorporó la misma política de `functions/loyalty-consumption.js` de la rama anterior fix/plan-analytics-v1 al Worker integrado, conservando las escrituras systemAudit por confirmación/anulación y el origen de la preview anterior. Se adaptó confirmar-visitas.html para enviar tipo, importe y motivos, con validación previa de la misma política y validación definitiva en el Worker. La generación de archivo único incluye las dos políticas compartidas. Se verificó sintaxis y diferencias, sin pruebas funcionales ni publicación. El callable heredado no se ha desplegado ni se usa como destino de la pantalla; no se debe activar como alternativa al Worker sin revisar su política de consumo.


### Publicación manual de preview confirmada por captura
La captura del propietario muestra la versión `50056353` activa en visitaloja-chabaquito-preview, con respuesta `/health` ok y consumo/temporada/sello/premio en versión 1. Esto confirma la carga de código, no credenciales de Firestore ni funcionamiento de visitas y canjes. El hostname estable de la rama improve/existing-rewards se conecta exclusivamente a ese Worker mediante runtime config. Los dominios públicos y previews no incluidas conservan el endpoint anterior. No se publicaron reglas ni se ejecutaron pruebas funcionales.


### Validación local ejecutada al retomar
Se ejecutaron las comprobaciones puras de `test-existing-loyalty-policy.cjs` y 33 casos de Node test entre pasaporte, aviso diario, condiciones, presentación de premios, entrega y creación de canje en servidor. Todos pasan. Se actualizó la fixture de entrega para incluir la generación de permisos nueva y se añadió el caso de revocación/actualización durante una entrega.

Se detectó y corrigió un fallo real de presentación: la cartera aceptaba únicamente códigos FID de seis caracteres y ocultaba los códigos de 16 caracteres generados por el Worker. Ahora admite ambos formatos con el límite de longitud del verificador. Se añadieron casos para ambos formatos y rechazo de longitud excesiva.

`test-passport-server-claim.cjs` usa exclusivamente una base simulada y dependencias Firebase simuladas. Comprueba pruebas de visita insuficientes, duplicadas, anuladas, de otra cuenta o campaña; diferencias Lojano/Turista; contador inventado del navegador; disponibilidad; elección inmutable y reintento que recupera el mismo código; vínculo de las seis visitas al canje. No prueba concurrencia real de Firestore, autenticación real, ejecución de reglas ni conexiones de la web al Worker. No se leyeron/escribieron registros reales ni se publicaron reglas. Esas pruebas de integración siguen pendientes.


### Reglas compiladas y comprobadas en emulador local
Se ejecutó el emulador oficial Firestore v1.19.8 con Firebase CLI 14.21.0 y proyecto ficticio `demo-visitaloja-rules`, únicamente en 127.0.0.1:8089. Las reglas completas compilan. Los 18 casos de `tests/firestore-rules/rewards.test.cjs` pasan. El archivo exige el host local exacto y no admite una conexión a una base real. No se inició sesión ni se emplearon credenciales reales.

Se confirmó que solo el negocio elegido puede leer/entregar el premio nuevo, aunque otro negocio tenga permiso de la misma campaña; el cliente no puede cambiar su elección ni entregarse su premio; cuentas suspendidas pierden acceso; una entrega no se repite; los permisos de canjes antiguos se mantienen; los sellos usados en un canje no se pueden anular por cliente; y el administrador conserva revisión/corrección.

Las pruebas adicionales detectaron que la regla de entrega de fidelidad permitía una escritura directa de entrega aun con premio vencido o sin fecha comprobable. Se corrigió exigiendo `expiresAt` de tipo timestamp y posterior a `request.time` para la entrega por negocio; ambos casos ahora se deniegan, mientras un premio vigente se entrega una sola vez. La corrección se aplicó solo al archivo de reglas de la rama, sin publicación.

Esta etapa cierra la validación local de los permisos modificados. Continúa pendiente el recorrido completo en la preview con cuentas y registros de prueba autorizados, y la publicación coordinada de reglas/frontend para no interrumpir el cliente antiguo de producción.


### Error 400 durante la primera confirmación manual
El propietario informó `Firestore query failed (400)` al confirmar una cortesía de prueba. Las únicas consultas runQuery del recorrido se ejecutan en la actualización de Misiones posterior al commit del sello; por ello el mensaje no demuestra que la visita haya fallado. Se pidió comprobar el contador del visitante antes de repetir o crear otra solicitud. No se comprobó el registro real desde este entorno.

Se corrigió el manejo posterior al commit de confirmación y anulación: un fallo de Misiones devuelve la visita/anulación guardada con `missionsPending: true`, y la pantalla informa que no debe repetirse el sello. Las consultas de evidencia se limitan a la subcolección del propio perfil, equivalente al alcance del servicio Node existente, sin consulta de grupo global. El Worker conserva detalles del rechazo de Firestore en sus logs para diagnosticar el 400 si persiste; no se afirma un índice específico sin respuesta del servicio. Health anuncia `missionSyncPolicyVersion:1` para identificar esta corrección.

Cuatro regresiones locales de `test-worker-mission-failure.cjs` pasan sobre el Worker generado: confirmación guardada con fallo posterior de Misiones; anulación guardada con fallo posterior; rechazo real antes del commit sin escrituras; consulta de evidencias limitada al perfil. Son dependencias de red simuladas, no pruebas contra producción. Requiere reemplazar únicamente el Worker preview con el archivo generado actualizado; no se ha publicado automáticamente.


### Recuperación de confirmación tras error posterior al guardado
El verificador permite consultar otra vez un código confirmado o anulado, incluso cuando ya venció el código temporal. Lee la visita, contador y programa actuales sin volver a sellar. Solo ofrece anulación al mismo encargado que confirmó, si es la última visita, no respalda un canje, su premio no está entregado y sigue dentro de los 15 minutos. Fuera del plazo muestra revisión administrativa; el servidor conserva todas las restricciones. Se corrigió también la carga de categoría de la parada para la política de compra/cortesía/turismo. Cuatro pruebas locales de recuperación pasan; no se modificó la visita real.
