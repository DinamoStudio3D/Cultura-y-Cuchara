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
