# Centro de recompensas web — especificación V1

Estado: propuesta de implementación, NO desplegada. Rama: feature/rewards-center-web-v1.

## Permisos
- Administrador: gestiona fidelidad de todas las paradas, premios generales del pasaporte y beneficios patrocinados; puede consultar canjes.
- Propietario: configura exclusivamente fidelidad de paradas asignadas. Puede verificar/entregar premios de pasaporte asignados a su negocio, pero NO crear ni editar esos premios.
- Los permisos deben comprobarse en el servidor y reglas, nunca solo ocultando botones.

## Fidelidad
- Editor visual por parada: título, descripción, imagen opcional, sellos requeridos, condiciones, vigencia, cupos, estado, temporada y vista previa.
- Conservar progreso, políticas fijadas al primer sello, historial de premios y límites diarios existentes. Advertir/bloquear cambios incompatibles con tarjetas iniciadas.
- No cambiar estructuras de Firebase sin auditoría y pruebas de migración.

## Pasaporte
- Solo el administrador configura premios por hitos. Los sellos NO se consumen.
- Diferenciar premio general de VisitaLoja y beneficio patrocinado (negocio, texto de reconocimiento, tipo de beneficio, condiciones, vigencia, cupos).
- Estados: bloqueado, desbloqueado, reclamado, entregado (y vencido/cancelado cuando aplique).
- Un premio por usuario/campaña/modalidad/hito/opción según reglas definitivas, con idempotencia y código único de canje.
- Proteger contra canjes duplicados y entregar solo por el negocio autorizado.
- No confundir el modelo actual de una finalización por usuario/campaña/modalidad con un catálogo de hitos. Se requiere cambio coordinado de backend, frontend y reglas.
- Mantener reglas actuales de paradas únicas y elegibilidad Lojano/Turista hasta aprobar una política nueva.

## Implementación segura
1. Auditar gestion-fidelidad.html, merchant-dashboard.html, merchant-rewards.html, siteContent/passport, loyaltyPrograms, functions/passport-claim.js, API y reglas.
2. Diseñar componentes reutilizables con accesibilidad y prioridad móvil.
3. Implementar editor de fidelidad aislado y probar permisos y compatibilidad.
4. Implementar metas del pasaporte con servicio transaccional y pruebas de concurrencia.
5. Probar con datos aislados, verificar versión real de servicios activos y solo después proponer Preview.
6. No desplegar Firebase, Cloudflare Worker ni fusionar main sin autorización expresa.

## Criterios de aceptación
- Propietario no puede editar pasaporte ni programas ajenos, incluso mediante peticiones directas.
- Administrador puede administrar beneficios patrocinados y generales.
- Canjear un premio no reduce sellos ni permite duplicados.
- Historial y recompensas emitidas conservan condiciones originales.
- La interfaz comunica con claridad errores, límites, estados y confirmación antes de cambios sensibles.
