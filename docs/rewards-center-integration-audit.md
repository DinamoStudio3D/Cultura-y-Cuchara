# Auditoría de integración del Centro de Recompensas (web)

Fecha: 2026-11-03. Rama: feature/rewards-center-web-v1. Sin acceso a datos reales ni despliegues.

## Hallazgos verificados en main
1. `gestion-fidelidad.html` utiliza `js/fidelity-admin-saves-v223.js` para guardar `loyaltyPrograms/{placeId}`.
2. El guardado administrativo actual valida `targetVisits` entre 10 y 30, `maxVisitsPerDay` entre 1 y 3, `rewardValidityDays` entre 1 y 365, `rewardType` en product/discount/surprise, y título máximo de 100 caracteres.
3. `saveProgram` ejecuta transacción y protege las temporadas utilizadas frente a cambios de condiciones. Esta protección no equivale por sí sola a autorización del propietario.
4. `merchant-dashboard.html` muestra premios y canjes, pero no se verificó un guardado de `loyaltyPrograms` autorizado para propietarios. No se debe reutilizar el guardado administrativo desde su sesión.
5. `functions/passport-claim.js` usa un documento de finalización por usuario/campaña/modalidad, por lo que varias metas reclamables requieren rediseño explícito y migración compatible.
6. La interfaz experimental `rewards-center-preview.html` no escribe en Firebase. Su selector permite visualizar menos de 10 sellos como exploración, pero el formulario conectado deberá respetar el rango real 10–30 hasta cambiar las reglas.

## Riesgos a resolver antes de conectar el formulario
- Autorizar la escritura de programas desde un servicio servidor para el propietario de la parada, comprobando asignación activa y límites; no habilitar escritura directa generalizada desde navegador.
- Conservar política de tarjeta iniciada, cupos, temporadas y premios emitidos; bloquear ediciones incompatibles.
- Asegurar que la gestión de recompensas esté disponible para propietarios sin depender indebidamente del plan de estadísticas.
- Revisar reglas Firestore efectivamente desplegadas y versión activa del Worker antes de publicar.
- Separar la configuración del pasaporte (solo admin) de su verificación/entrega (negocio autorizado).

## Próximo bloque de código
1. Definir servicio de escritura con permisos por rol y validación del lado servidor.
2. Añadir editor web reutilizable que lea programa actual y muestre una vista previa segura.
3. Integrar primero en Preview de administrador; luego en el portal del propietario tras probar autorización.
4. Probar accesos cruzados entre dos paradas, tarjetas con sellos, temporadas, cupos y concurrencia.

No tocar `main`, Firebase de producción ni Cloudflare en esta fase.
