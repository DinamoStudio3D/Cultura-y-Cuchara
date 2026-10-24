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
