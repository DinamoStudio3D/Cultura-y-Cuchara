# Activación de estadísticas por plan

La Preview no despliega reglas ni escribe permisos en producción.

## Orden de publicación

1. Aprobar y publicar el código web en main.
2. Desde el administrador actualizado, revisar y guardar los planes. Solo después de guardar correctamente, se sincronizan los documentos `businessEntitlements` de las paradas existentes. No cambian sus importes cobrados ni se eliminan datos. Si falla la sincronización, el panel muestra la operación pendiente y permite reintentar.
3. Crear el índice `businessEvents: placeId ASC, createdAt ASC` definido en `firestore.indexes.json`; esperar a que esté listo, conservando los otros índices existentes.
4. Publicar `firestore.rules`. No hacerlo antes de sincronizar permisos: los negocios sin un permiso administrativo válido no podrán registrar ni leer estadísticas.
5. Con una cuenta de propietario, comprobar Emprendo (30 días), Activo (90 días), Premium (365 días), Gratis (sin estadísticas), vencimiento y negocio ajeno. El corte comienza a medianoche de Ecuador e incluye el día actual.

Los registros operativos de fidelidad conservan sus permisos para validar visitas y canjear recompensas. La restricción del historial web se aplica a `businessEvents`; las tablas y totales analíticos de fidelidad se calculan solo sobre las visitas del período seleccionado.

## Pruebas reproducibles

- `node --test scripts/test-business-analytics.mjs scripts/test-merchant-dashboard-v85.mjs scripts/test-merchant-dashboard-v86.mjs scripts/test-merchant-workspace-v218.mjs scripts/test-plan-offer.mjs scripts/test-place-video.mjs scripts/test-admin-place-gallery.mjs scripts/test-admin-analytics-presentation.mjs`
- Con Firebase CLI, `@firebase/rules-unit-testing` y `firebase` instalados, ejecutar `firebase emulators:exec --only firestore --project demo-visitaloja 'node --test scripts/test-business-analytics-rules.cjs'`. El test rechaza ejecución remota sin emulador y usa únicamente el proyecto demo. `VL_RULES_TEST_ROOT` permite resolver dependencias desde una carpeta de pruebas externa.

No existe un reporte mensual enviado automáticamente. Los datos se consultan al abrir o actualizar el panel. Las aperturas de productos representan consultas del apartado, no ventas ni clics de un producto individual. Los consumos son importes registrados en visitas confirmadas, no facturación automática.

## Consumo obligatorio y auditoría

La pantalla nueva verifica `/health.consumptionPolicyVersion >= 1` antes de enviar una confirmación o anulación. Si el Worker aún no está actualizado, no se envía la operación. La Preview Vercel no despliega Cloudflare ni las funciones de Firebase.

Antes de activar este bloque hay que publicar el Worker actualizado y autorizar expresamente el origen utilizado para las pruebas. No abrir todos los dominios Preview con un comodín. La ruta de `wrangler.jsonc` ahora se resuelve desde su propia carpeta y se verificó con `wrangler deploy --dry-run`.

También se actualizó la función alternativa `confirmLoyaltyVisit` / `reverseLastLoyaltyVisit` para mantener la misma política si se utiliza. No cambiar el sistema actual de alojamiento ni activar Firebase Blaze para probarla.

- Compra: importe positivo, hasta dos decimales y máximo $100.000; mínimo adicional configurable por negocio.
- Cortesía: importe cero y motivo obligatorio. Se identifica en el historial, sin presentarse como una venta.
- Turismo: exención solo si el servidor comprueba `locales.category == turismo`.
- Anulación: motivo obligatorio, autor original, último sello y plazo existente de 15 minutos. Se conserva el registro original y se añade auditoría.
- La bitácora `systemAudit` se escribe en la misma transacción que la visita. Las reglas bloquean escrituras directas de clientes a `loyaltyVisits` para evitar saltarse la validación.
- Los registros históricos sin importe/tipo no se convierten en compras de cero: se identifican y excluyen del promedio.

`/scripts/review-consumption.html` es una demostración aislada sin Firebase. Reutiliza la validación compartida y los campos de la pantalla real; nunca registra sellos.
