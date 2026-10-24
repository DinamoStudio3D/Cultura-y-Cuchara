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
