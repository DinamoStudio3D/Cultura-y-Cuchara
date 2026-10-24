# Recompensas V2 — estado de implementación

## Estado real

Código en la rama `feature/reward-configuration`. No se ha desplegado el backend, no se han publicado reglas V2 y no se han habilitado las tarjetas nuevas para clientes. Las pruebas funcionales de esta ampliación están aplazadas por indicación del propietario. Solo se ha revisado sintaxis y formato del diff.

## Implementado en código

- Editor de tarjetas por parada, tarjetas de temporada y pasaportes Lojano/Turista.
- Metas, límite diario, consumo mínimo, condiciones, vigencias, repetición y premios con stock/plazo de entrega.
- Temporadas identificadas por separado, sin solapamiento entre temporadas activas; selección de temporada vigente y regreso a la habitual al terminar. Inscripciones separadas conservan su política inicial.
- Borradores privados por administrador, guardado transaccional y comparación de revisiones. La propuesta local previa se importa si no existe borrador remoto. Sin reglas desplegadas, el editor informa del fallo y no simula un guardado correcto.
- Publicación versionada con historial inmutable y comprobación de paradas y encargados de entrega.
- Créditos V2 a partir de visitas confirmadas; validación de encargado, usuario, parada, fechas, consumo y límite diario.
- Consulta de visitas originales antes de emitir/entregar premios, para excluir visitas anuladas. Conciliación explícita del crédito diario tras anulación.
- Catálogo y cartera del visitante, inscripción, progreso y solicitud de premios.
- Consulta del encargado por código y entrega con validación transaccional.
- Componentes de publicación administrativa, cartera y entrega; no se cargan en la web pública.
- Transporte autenticado, límite de cuerpo, control de origen, comparación de sesión y protección frente a respuestas tardías.

## Entorno integrado preparado

`sandbox/reward-programs.html` reúne acceso, cartera, entrega, editor y publicación. `sandbox/reward-programs-bootstrap.js` inicializa exclusivamente una app Firebase aislada y monta las pantallas. Los controles administrativos se muestran tras autorización del servidor.

`scripts/serve-reward-programs-sandbox.cjs` sirve únicamente esa página, sus recursos permitidos y las operaciones de `lib/reward-programs-http.cjs`. No arranca durante el build ni modifica endpoints existentes. Reutiliza las dependencias del paquete `functions`.

Para alojarlo se necesitan estas variables del host:

- `REWARD_SANDBOX_PROJECT_ID`: proyecto diferente de `cultura-y-cuchara`.
- `REWARD_SANDBOX_FIREBASE_CONFIG`: JSON de configuración pública de la app de ese proyecto.
- `REWARD_SANDBOX_ORIGIN`: origen HTTPS exacto de Preview, diferente del dominio público.
- Credenciales administrativas del proyecto aislado mediante Application Default Credentials.
- Opcional: `REWARD_SANDBOX_PORT` (8788) y `REWARD_SANDBOX_BIND` (127.0.0.1).

Inicio previsto: `node scripts/serve-reward-programs-sandbox.cjs`, detrás de un proxy HTTPS del origen configurado. No se ha iniciado. El host debe tener acceso a Firebase Auth y Firestore del proyecto aislado. No imprimir ni guardar credenciales en el repositorio. Autorizar el dominio de Preview en Firebase Auth y preparar cuentas administrativas/de negocio de prueba.

El handler rechaza el proyecto Firebase de producción y los orígenes públicos. El verificador comprueba tokens revocados y audiencia/emisor del proyecto aislado. No hay acceso de emergencia por correo en este backend nuevo. Los roles se resuelven mediante claims o perfiles administrativos activos.

## Pendientes antes de activar

1. Crear/configurar y alojar el proyecto aislado y su Preview. El código por sí solo no crea la infraestructura.
2. Conectar confirmación y anulación de visitas al nuevo motor de forma coordinada; actualmente son operaciones separadas. Evitar que una visita se acredite a varias inscripciones.
3. Definir y ejecutar una migración del progreso verificado, conservando sellos y premios. Bloquear doble emisión entre legado y V2. No importar contadores sin origen comprobable.
4. Completar renovación de ciclos con nuevas versiones, recuperación de solicitudes interrumpidas y reglas de final de temporada para premios aún no solicitados.
5. Resolver cancelación/liberación de stock para premios que pierden elegibilidad por anulación. Actualmente la entrega queda bloqueada y requiere revisión; no se libera stock automáticamente.
6. Ajustar las consultas a índices/paginación para un volumen grande y preparar las reglas finales del cliente.
7. Después, realizar las pruebas completas del visitante, encargado y administrador que el propietario dejó para más adelante.

No afirmar que el sistema está listo para producción ni fusionar esta ampliación a main mientras estos puntos sigan abiertos. La demo `tests/reward-programs-review.html` sigue usando memoria y no valida el backend real.

## Ampliación: asignación única e inspección de transición

El servicio registra una asignación transaccional por visita en `rewardVisitAllocationsV2`, compartida por todas las tarjetas de fidelidad. Una visita no puede acreditarse a dos inscripciones. Además compara la tarjeta seleccionada para la fecha del sello con la inscripción solicitada para evitar acreditar la habitual durante una temporada distinta. Esto no impide que esa visita contribuya al pasaporte, que cuenta paradas diferentes.

`lib/reward-programs-transition.cjs` prepara una inspección administrativa de solo lectura por cuenta/parada. Compara contadores con visitas confirmadas y su origen, ciclos y premios ya emitidos, calcula el remanente con la meta antigua y devuelve bloqueos y una huella de la evidencia. No mueve datos, no modifica los sellos y no crea premios. Una evidencia consistente no autoriza por sí sola la migración: sigue pendiente revisar las condiciones históricas, obtener una exportación verificada del origen y coordinar el cambio de motor.

La operación `admin/inspect-transition` se expone únicamente en el handler aislado. Inspecciona los datos de ese entorno; no se conecta al proyecto activo. Falta usar una copia verificada para evaluar los datos actuales. No se realizaron pruebas funcionales de esta ampliación.

## Reintentos de solicitud y cupos vencidos

La solicitud de fidelidad exige el ciclo esperado por el visitante. Su identificador se calcula antes de evaluar un ciclo nuevo: repetir la misma solicitud devuelve el premio existente y no consume otro ciclo. Un pasaporte devuelve su elección anterior y la cartera deshabilita nuevas elecciones después de solicitar el premio.

`expireClaim` permite al propietario o al encargado autorizado liberar de forma transaccional un premio pendiente cuyo plazo ya venció. La actualización del estado y la devolución del cupo son atómicas; los premios entregados o ya vencidos no devuelven cupos por segunda vez. El premio conserva su registro y el ciclo consumido, por lo que la caducidad no crea otra recompensa gratuita. La cartera concilia hasta 20 vencimientos por consulta y comunica si algún cupo necesita revisión. La consulta de códigos del encargado también concilia un premio vencido.

La cartera usa la hora del servidor para mostrar vencimientos. Sigue pendiente conciliar premios invalidados por anulación de sellos (no es el mismo caso que vencimiento), completar renovación de políticas, transición y entorno aislado. Esta ampliación no se ha sometido a pruebas funcionales ni se ha desplegado en producción.
