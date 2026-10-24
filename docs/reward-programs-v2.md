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

## Confirmación atómica de visitas en el entorno aislado

Se añadieron `customer/visit-code` y `merchant/confirm-visit`, con sus controles en cartera y panel del encargado. El código V2 usa 12 caracteres hexadecimales, dura diez minutos y se conserva mientras esté pendiente. No se genera en la colección de códigos del motor legado. Solo la tarjeta actualmente seleccionada por la configuración puede generar un código.

El encargado registra el consumo y confirma presencia/condiciones. El servidor valida asignación, propietario, tarjeta vigente, consumo, caducidad y cuota diaria. La visita original, la asignación única, el crédito y la confirmación del código se escriben en la misma transacción. Un reintento por el mismo encargado devuelve la confirmación anterior; no añade otro sello. Esta operación existe exclusivamente en el backend aislado preparado, no en el Worker activo.

Pendiente conectar una anulación atómica equivalente, completar la transición y preparar la infraestructura. No se han probado estos recorridos. La afirmación anterior de que confirmación y créditos eran operaciones separadas queda sustituida para este nuevo endpoint; la conciliación de visitas preexistentes sigue siendo una operación separada.

## Anulación atómica en el entorno aislado

`merchant/reverse-visit` permite al encargado original anular únicamente la visita más reciente de la parada, durante quince minutos y con un motivo obligatorio. Verifica acceso vigente, origen V2, código, crédito y cuota diaria. Actualiza visita, crédito, código y cupo diario en una sola transacción. Repetir una anulación ya registrada no vuelve a restar el cupo.

Antes de escribir, recalcula los premios del usuario excluyendo la visita. Si afecta un premio entregado, rechaza la operación para revisión administrativa. Los premios pendientes que pierden elegibilidad pasan a `needs-review` y quedan bloqueados para entrega; la cartera muestra el motivo. Los premios que siguen siendo elegibles se conservan. La interfaz del encargado ofrece anulación después de confirmar, sin borrar el historial.

La anulación NO libera automáticamente el stock de premios bloqueados ni emite reemplazos. Sigue pendiente resolver o recuperar esos premios de forma administrativa, además de la renovación de políticas, migración y configuración del entorno. No se realizaron pruebas funcionales ni se modificó el Worker activo.

## Resolución administrativa de premios bloqueados

Se añadieron `admin/review-queue` (hasta 50 pendientes) y `admin/resolve-review`, autorizados en el servidor con los mismos permisos administrativos. El apartado «Revisar premios» del sandbox permite registrar un motivo y elegir entre:

- Recuperar el premio solo si vuelve a cumplir la meta con visitas vigentes y no ha vencido. Conserva su código, premio, plazo y reserva originales.
- Cancelar el premio y devolver su cupo en la misma transacción. No borra el historial ni concede otro ciclo automáticamente. La interfaz exige confirmar ese efecto.

La resolución comprueba el sello que originó la revisión, evita actuar sobre una revisión diferente y crea una auditoría identificada por premio, visita y decisión. Repetir una resolución ya registrada no devuelve un segundo cupo. Los visitantes y encargados no tienen acceso a estas operaciones administrativas. La cartera muestra los premios cancelados como tales.

Esta ampliación resuelve el manejo explícito de los premios bloqueados del endpoint V2, pero NO sustituye la transición del sistema legado, renovación de condiciones ni la configuración del proyecto aislado. No se realizaron pruebas funcionales ni cambios de producción.

## Renovación de condiciones y protección de progreso anterior

`customer/renew-loyalty` permite pasar a una versión nueva de las condiciones de la misma tarjeta únicamente cuando el ciclo anterior terminó y todos los premios alcanzados fueron solicitados (o antes del primer sello). No renueva si quedan premios bloqueados para revisión. La operación conserva la inscripción anterior como historial, crea una nueva con su política inmutable y actualiza la referencia de tarjeta vigente en una transacción. Repetir la renovación devuelve la inscripción existente. Las tarjetas de temporadas diferentes mantienen referencias independientes.

La cartera muestra las condiciones nuevas y deshabilita la renovación si queda progreso parcial. La tarjeta sustituida deja de emitir códigos; sus premios existentes siguen teniendo su snapshot y su plazo originales. Las tarjetas no repetibles dejan de aceptar sellos al completar la meta. El cupo diario ahora se comparte por usuario/parada/día para que cambiar de temporada o renovar no lo reinicie.

Se añadió un bloqueo de convivencia: si la base aislada contiene un contador legado con progreso o visitas confirmadas del motor anterior, no se permite abrir/acreditar una tarjeta V2 ni arrancar un pasaporte paralelo. No hay un botón que evite este bloqueo. La inspección de transición sigue siendo de solo lectura.

**Límite real de la transición:** no se ha importado progreso ni validado una exportación de los datos actuales. Falta disponer de esa copia verificable, revisar sus discrepancias y definir la correspondencia de los premios ya emitidos antes de escribir una migración aplicable. No se puede considerar ese traslado terminado solo por añadir código. El entorno aislado tampoco está configurado. Las pruebas siguen aplazadas y no se ha tocado main.

## Proyecto aislado identificado y host de Preview

Se verificó en la consola la existencia de `vivelojapruebas`, app web `visitalojapruebas`, base Firestore vacía y plan Spark. Se inicializó Authentication; los proveedores continúan deshabilitados. No se copiaron datos personales ni se modificó el proyecto activo.

`sandbox/firebase-public-config.json` contiene exclusivamente la configuración pública observada de esa app. `api/reward-sandbox.js` adapta el servicio a Vercel y solo responde si `VERCEL_ENV=preview`, la rama es `feature/reward-configuration` y `REWARD_SANDBOX_PROJECT_ID=vivelojapruebas`. Usa una credencial independiente, `REWARD_SANDBOX_SERVICE_ACCOUNT_JSON`, valida su proyecto y nunca reutiliza la variable de producción. `REWARD_SANDBOX_ORIGIN` limita el origen exacto de la Preview. Las rutas aisladas se añadieron a `vercel.json`; no reemplazan las rutas públicas existentes.

Pendiente autorización a la hora de habilitar proveedores y crear una credencial administrativa del proyecto aislado; su destino previsto es un secreto de Vercel limitado a Preview y a esta rama. No se ha creado ni transferido esa credencial. La página informa de configuración incompleta mientras falte el servidor. No hay pruebas funcionales realizadas.

## Accesos y ajuste al plan gratuito

Google y correo/contraseña se habilitaron en `vivelojapruebas`; el propietario autorizó expresamente usar su correo como asistencia de Google. No se crearon usuarios ni se copiaron datos.

Vercel rechazó la Preview por exceder el límite de 12 funciones del plan Hobby. La entrada aislada se movió a `lib/reward-sandbox-vercel.cjs` y se despacha desde `api/chabaquito-ranking.js` únicamente con el parámetro de ruta aislada y los bloqueos de rama/proyecto ya existentes. El ranking conserva su ruta normal. El helper legado ahora selecciona explícitamente la app Firebase predeterminada para no reutilizar por accidente la app aislada del mismo proceso. Este ajuste no cambia main ni añade planes de pago.

La clave del servidor todavía no se ha generado: la consola está en el diálogo previo a crearla. Su creación requiere confirmación al momento de conceder este acceso administrativo. El destino previsto es el secreto Vercel de esta rama de Preview, nunca GitHub ni el cliente.
