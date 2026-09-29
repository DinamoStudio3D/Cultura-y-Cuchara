# Chabaquito V1 — base aislada (sin activar)

La configuración y las reglas de esta fase no están conectadas a la web ni desplegadas. Los cinco retos digitales actuales siguen en `localStorage` para su presentación y su funcionamiento anterior; sus clics **no** generan XP. Cloudinary permanece desactivado y las imágenes siguen usando Firebase.

## Límite de confianza

`FRONTEND → BACKEND NECESARIO → FIRESTORE`

El frontend solicita una acción autenticada. Un backend independiente verifica el token Firebase, consulta la evidencia y escribe en una transacción atómica. Nunca acepta `uid`, XP, estado de QR, distancia, insignia ni confirmación de visita declarados por el cliente como prueba suficiente. Este backend puede alojarse fuera de Firebase Functions, pero **no existe ni está conectado en esta fase**. No se requiere ni se activa Firebase Blaze para este modelo aislado.

* `confirmed_visit`: backend lee `loyaltyVisits/{visitId}` y su estado `confirmed`, su propietario y, si procede, el `visitCodes/{visitId}` correspondiente. Usa `confirmed_visit:visitId` como clave; si cambia a `reversed`, actualiza la evidencia de Chabaquito y recalcula XP. No escribe en Fidelidad ni Pasaporte ni cambia la transacción del encargado.
* `self_visit`: backend comprueba usuario autenticado, marcador QR activo e identificador de punto registrado, coordenadas del punto, radio configurable, distancia y precisión razonable. Usa un ID de canje canónico y límite por usuario/punto/objetivo; bloquea reenvíos. El GPS web puede falsificarse: no se atribuye garantía de presencia física, y el QR debe ser distinto del QR de marketing o check-in. Falta definir marcadores firmados o tokens rotatorios y controles de abuso antes de activarlo.
* `digital_objective`: backend valida un evento específico para el objetivo y concede una única vez usando una clave estable. Abrir mapa, postal, agenda o podcast con un clic actual **no es prueba validada**. El catálogo de cinco retos permanece intacto; cada conversión requiere definir su propia comprobación.

## Contrato de persistencia propuesto

| Documento | Campos relevantes | Acceso previsto |
| --- | --- | --- |
| `chabaquitoExplorerProfiles/{uid}` | publicAlias, participateInRanking, validatedXp, level, publicBadgeIds, createdAt, updatedAt | usuario lee; backend escribe |
| `chabaquitoExplorerProfiles/{uid}/evidence/{encodedKey}` | type, sourceId, proofId, status, verifiedAt, reversedAt, auditoría | usuario lee; backend escribe |
| `chabaquitoExplorerProfiles/{uid}/xpEvents/{encodedEventId}` | adventureId, objectiveId, evidenceKey, xp, status, timestamps | usuario lee; backend escribe |
| `chabaquitoAdventureProgress/{uid}_{adventureId}` | completedObjectives, completed, xp, badgeIds, updatedAt | usuario lee; backend escribe |
| `chabaquitoPublicRanking/{opaqueId}` | alias, avatar, level, xp, badgeIds | lectura pública solo con consentimiento; backend escribe |

La clave de evidencia es `type:sourceId`; se codifica de forma inequívoca antes de usarla como ID de documento. El documento conserva su estado actual y auditoría: `reversed` no borra la visita. Los eventos de XP tienen ID determinista por aventura/objetivo y estado concedido o revocado; cada cambio genera un documento en `xpAudit`. El servicio preparado reconcilia perfil, progreso y eventos en una transacción; la proyección de ranking todavía no se escribe. Para Top 5 se consultará esa proyección ordenada por XP, sin `uid`, email, teléfono, ubicación ni historial privado. El alias requiere consentimiento explícito; desactivar ranking retirará su proyección.

`js/chabaquito-v1-core.js` calcula la aventura desde el estado de evidencias verificadas, deduplica sus claves, asigna una evidencia a un solo objetivo y produce el cambio de eventos XP. Valores piloto configurados allí: cinco objetivos de 50 XP, bono de 250 XP, total máximo de 500 XP e insignia `Amigo de Chabaquito`. La progresión es 1 → 2 → (3 y 4 en cualquier orden) → 5; una evidencia anterior al desbloqueo no se acredita retroactivamente. Los niveles son 0, 500, 1500, 3000, 5000, 8000, 12000 y 20000 XP con sus nombres en `LEVELS`. La evaluación es pura y no acredita ninguna evidencia por sí misma.

El catálogo público `js/chabaquito-v1-pilot.js` contiene los textos y opciones del piloto. La tercera pregunta cultural está marcada `TODO_CONTENT`: no existe fuente verificable en la configuración actual. `functions/chabaquito-v1-digital.js` conserva las claves de las dos preguntas habilitadas en el lado previsto del backend; se exige 2/3 para aprobar. Debe ejecutarse con un UID autenticado, lectura de evidencias previa y transacción antes de que conceda XP. `functions/chabaquito-v1-self-visit.js` verifica un punto y marcador activos obtenidos del repositorio confiable, radio y precisión; evita guardar coordenadas exactas en la evidencia. La validación de posición web no impide suplantación GPS, por lo que hacen falta controles de abuso y backend real. `POINT_A`, `ESTABLISHMENT_B` y `POINT_C` son placeholders desactivados y no hay QR físicos.

`index.html#misiones` presenta una tarjeta de aventura aislada bajo los cinco retos actuales. `js/chabaquito-v1-preview.js` permite **simular** el circuito con estado efímero de memoria, incluso las visitas; sus respuestas y claves de demostración son visibles en el navegador y no constituyen validación de seguridad. Muestra etiquetas “simulación sin guardar”, no invoca el backend ni realiza escrituras. Al recargar, el demo vuelve a 0/5; el progreso real no está activo. El Top 5 no aparece todavía.

`functions/chabaquito-v1-confirmed-service.js` es un módulo aislado, no exportado desde `functions/index.js` ni expuesto en `/api`. Solo un backend autenticado debe pasarle el UID comprobado. En una transacción consulta `loyaltyVisits/{visitId}` y `visitCodes/{visitId}` y exige el mismo propietario y estado; de allí deriva `confirmed_visit`. La repetición no escribe XP de nuevo. Una reversión conserva evidencia y auditoría, retira XP y bono e invalida la insignia. El código no hace escritura de prueba contra Firebase: `functions/chabaquito-v1-confirmed-service.test.js` utiliza Firestore simulado en memoria.

## Antes de habilitar

Implementar endpoint autenticado con transacción para las evidencias digitales y autónomas, reglas Firestore restrictivas, proyección Top 5 con consentimiento/alias único/moderación y entorno Firebase aislado para pruebas. Hace falta una estrategia de reconciliación de visitas revertidas aunque el usuario no abra la página: la transacción actual del encargado no llama a este servicio y no debe modificarse por accidente. Precisar los lugares `POINT_A`, `ESTABLISHMENT_B` y `POINT_C` antes de habilitarlos, sus coordenadas/radios, el QR activo y la tercera pregunta cultural. Revisar índices necesarios para Top 5 y límites/costos del backend elegido. Ningún cambio de reglas o infraestructura forma parte de esta fase.
