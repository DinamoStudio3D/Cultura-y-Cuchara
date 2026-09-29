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
| `chabaquitoExplorerProfiles/{uid}` | alias, rankingOptIn, validatedXp, level, publicBadgeIds, createdAt, updatedAt | usuario lee; backend escribe |
| `chabaquitoExplorerProfiles/{uid}/evidence/{encodedKey}` | type, sourceId, proofId, status, verifiedAt, reversedAt, auditoría | usuario lee; backend escribe |
| `chabaquitoExplorerProfiles/{uid}/xpEvents/{encodedEventId}` | adventureId, objectiveId, evidenceKey, xp, status, timestamps | usuario lee; backend escribe |
| `chabaquitoAdventureProgress/{uid}_{adventureId}` | completedObjectives, completed, xp, badgeIds, updatedAt | usuario lee; backend escribe |
| `chabaquitoPublicRanking/{opaqueId}` | alias, avatar, level, xp, badgeIds | lectura pública solo con consentimiento; backend escribe |

La clave de evidencia es `type:sourceId`; se codifica de forma inequívoca antes de usarla como ID de documento. El documento conserva su estado actual y auditoría: `reversed` no borra la visita. Los eventos de XP tienen ID determinista por aventura/objetivo y estado concedido o revocado; se conserva su historial. Perfil, progreso, eventos y proyección de ranking se reconcilian atómicamente por usuario. Para Top 5 se consulta la proyección ordenada por XP, sin `uid`, email, teléfono, ubicación ni historial privado. El alias requiere consentimiento explícito; desactivar ranking retira su proyección.

`js/chabaquito-v1-core.js` calcula la aventura desde el estado de evidencias verificadas, deduplica sus claves, asigna una evidencia a un solo objetivo y produce el cambio de eventos XP. Valores piloto configurados allí: cinco objetivos de 50 XP, bono de 250 XP, total máximo de 500 XP e insignia `Amigo de Chabaquito`. La evaluación es pura y no acredita ninguna evidencia por sí misma. Los niveles se calculan con umbrales configurables.

## Antes de habilitar

Implementar backend autenticado y su adaptador transaccional, reglas Firestore restrictivas, entorno Firebase aislado para pruebas y estrategia de reconciliación de visitas revertidas aunque el usuario no abra la página. Revisar índices necesarios para la consulta Top 5 y límites/costos del backend elegido. Ningún cambio de reglas o infraestructura forma parte de esta fase.
