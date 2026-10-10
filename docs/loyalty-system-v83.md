# V83 — Puntos independientes por parada y seguidores

Base a3bfde2 (V82). Rama exclusiva design/modernizacion-web-v1.

## Estado de entrega

Código de servicio y conexión de interfaz preparados; NO activado en Firebase. La Preview de Vercel publica únicamente la web. No se desplegaron Cloud Functions ni reglas y no se modificaron usuarios, permisos o datos reales. No presentar esta fase como puntos o seguidores operativos en producción.

Las tres pantallas incorporan preparación y simulación explícitas. Sin servicio disponible, publicación y preferencias reales quedan bloqueadas. No se inicia ninguna llamada de puntos/seguidores al abrir las páginas; Consultar servicio es una acción expresa y solo de lectura. La capa web está conectada a los nombres de los servicios futuros, pero su disponibilidad no se deduce de que exista una Preview READY.

## Decisión confirmada

Puntos por parada, separados del XP de Chabaquito y de los premios existentes por metas de sellos. Los puntos no se transfieren entre paradas, incluso si pertenecen al mismo dueño. Solo se otorgan al confirmar nuevos sellos mediante confirmLoyaltyVisit. Sin migración ni puntos retroactivos de visitas antiguas. No tienen vencimiento en esta fase; vence la reserva de un beneficio, no el saldo.

## Backend preparado

loyalty-points-service.js contiene servicios con autorización server-side y transacciones. Sus callables en functions/index.js son configureLoyaltyPoints, saveLoyaltyPointReward, redeemLoyaltyPoints, settleLoyaltyPointClaim, setLoyaltyFollow, getLoyaltyPointWallet y getLoyaltyPointOverview.

- settings/loyaltyV83.enabled debe ser true para otorgar puntos, seguir, configurar, reservar o entregar. Ausente/false conserva confirmaciones anteriores sin puntos. maxPointsPerStamp: 50 por defecto, límite 1–1000. No se crea este documento automáticamente. El límite global del formulario es un borrador; su publicación requiere una fase administrativa de activación separada, no se envía como parte de la configuración de una parada.
- loyaltyPointPrograms/{placeId}: enabled, ownerCanConfigure, pointsPerStamp. Admin por claim, adminUsers activo o identidad propietaria existente. El dueño debe estar activo y tener la parada en missionRewardMerchants; solo puede editar si admin habilitó ownerCanConfigure. No puede autoactivarse ni ampliar permisos.
- loyaltyPointAccounts: saldo, ganado y gastado por UID/parada. El navegador nunca escribe el saldo.
- loyaltyPointLedger: movimientos stamp/reverse/redeem/refund con claves deterministas y hash de tuplas sin colisiones de separadores.
- La acreditación participa en la misma transacción que sello, código, contador, premio antiguo y auditoría. No hay trigger eventual de puntos ni otorgamiento por visitas pendientes. La visita conserva pointsEarned; reversión usa ese valor histórico aunque cambie la tasa. Confirma/revierte comprueban también permiso del negocio dentro de la transacción.
- Si al anular el último sello el saldo es menor que sus puntos, se bloquea toda la anulación sin cambios parciales. Se puede cancelar primero un canje pendiente para devolver puntos. No se devuelve un canje entregado automáticamente. Para visitas antiguas pointsEarned ausente equivale a cero.
- loyaltyPointRewards: catálogo por parada, costo entero, condiciones, stock total opcional, issued (reservas/entregas), active y días de retiro. El stock no puede reducirse por debajo de issued. Puede pausarse un beneficio sin borrar sus canjes.
- loyaltyPointClaims: reserva descuenta puntos y ocupa stock atómicamente. Clave por usuario/parada/requestId; repetir misma solicitud no descuenta de nuevo. La interfaz mantiene requestId local al fallar para permitir reintento. Clientes no eligen usuario, costo, saldo o stock; se obtienen en servidor. Entrega requiere admin o dueño asignado; canje vencido no se entrega. Cliente puede cancelar únicamente sus canjes pendientes, aun si se pausa la plataforma; devuelve puntos y libera stock una sola vez. La pausa también permite anular sellos ya acreditados.
- loyaltyFollows: seguimiento y preferencias voluntarios; promociones/cumpleaños independientes, versión de consentimiento, pushConsent siempre false. Dejar de seguir elimina ambas preferencias aunque la plataforma esté pausada. No se copian contactos, fecha de nacimiento ni perfiles a la colección. Sellar, visitar o tener tarjeta no crea seguidores.
- Propietario/admin consultan conteos de seguidores consentidos, catálogo y códigos pendientes de la parada; no reciben lista de perfiles, cumpleaños ni correos. Cliente consulta sus saldos, movimientos y canjes. Lecturas limitadas a 50 beneficios activos/100 canjes y movimientos; no se promete paginación o historial completo. Conteos actuales consultan documentos de seguidores; antes de gran escala implementar agregaciones/paginación.

Colecciones nuevas: protegidas por el rechazo general existente de Firestore. Acceso previsto exclusivamente mediante callables, cuya autorización se valida en servidor. No se añadieron reglas de acceso directo ni se desplegaron reglas. Falta validar esta combinación con emulador e índices requeridos por consultas compuestas.

## Interfaz

- gestion-fidelidad.html: apartado en el panel existente, borrador por UID/parada, habilitación de puntos y permisos del dueño, tasa, límite global de preparación y catálogo. Los dos botones separados de publicación informan resultados separados: guardar programa no implica guardar beneficio.
- merchant-dashboard.html: mismas herramientas limitadas a la lista de paradas que ya carga el portal. Se conserva su restricción actual por plan/estadísticas; NO se amplió el acceso a negocios sin ese plan. Su disponibilidad para todos los planes debe decidirse antes de lanzamiento.
- fidelidad.html: apartado dentro de la cartera; selector de parada, ejemplo de saldo claramente marcado, simulación, seguimiento y preferencias sin casillas preseleccionadas. Cuando el servicio esté habilitado muestra saldo real, catálogo, movimientos, reservas y cancelación. Códigos de canje son identificadores largos y se presentan en la web; una presentación QR/código corto queda pendiente.
- confirmar-visitas.html: respuesta de confirmación puede informar puntos acreditados. Error de reversión explica que se requieren puntos disponibles. No genera puntos en el navegador.
- Borradores no se publican, ni se reutilizan entre cuentas/paradas. HTML se escapa y los ejemplos usan textContent. Respuestas retrasadas tras cambiar cuenta/parada se descartan. Estilos incluyen el contrato de color de la cartera para preservar contraste en tarjetas claras y campos oscuros.

## Verificación

19 pruebas nuevas de backend, incluyendo los handlers reales de confirmación/reversión y wrappers callable con Firebase simulado. El mock rechaza lecturas después de escrituras, aplica operaciones al completar la transacción y serializa llamadas concurrentes. Comprueba rollback, tasa histórica, saldo separado, reintentos, stock, permisos/revocación, expiración, pausa, devolución y privacidad. No es una certificación del emulador de Firestore ni del proveedor.

5 pruebas de contrato DOM con APIs simuladas: cero llamadas al abrir/borradores, separación por cuenta/parada, simulación, falta de servicio, descarte de respuestas retrasadas y preferencias sin consentimiento automático. No equivalen a prueba visual ni a navegador real.

Suites backend: 96/96 (77 existentes + 19 nuevas). Suites técnicas focalizadas: 20/20 (V82/seguridad/cumpleaños + 5 UI). Sintaxis de scripts inline de las páginas, JS de servicio/interfaz, validate-site y git diff --check correctos.

La herramienta de navegador indicada por Sites no está disponible en este entorno administrado; se omitió QA visual conforme al flujo de Sites. Pendiente revisar escritorio/móvil en navegador antes de dar la fase por certificada visualmente.

## Antes de activar datos reales

1. Validación en proyecto Firebase/emulador aislado con SDK real: concurrencia/reintentos de transacciones, índices, acceso de múltiples admins y dueños, revocación durante operación y queries limitadas.
2. Revisar reglas efectivas, App Check (se conserva enforceAppCheck:false existente), límites de frecuencia y costos. No habilitar otorgamientos por una edición de configuración sin esta revisión.
3. Autorizar explícitamente despliegue de Functions y activación del documento settings/loyaltyV83. Ajustar primero permisos y tasas de las paradas aprobadas. Sin retroactividad.
4. QA visual y prueba completa con cuentas de prueba autorizadas, de sello a saldo, canje, entrega/cancelación y reversión.
5. Añadir paginación/estadísticas escalables, ajustes administrativos auditados si se requieren y política operativa de reclamos. No existen ajustes manuales de saldo en V83.

Promociones generales, bandeja/envíos, cumpleaños automatizados y push siguen pendientes. V83 guarda preferencias preparadas para esos servicios; no realiza envíos.
