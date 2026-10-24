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
