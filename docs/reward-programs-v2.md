# Recompensas V2: alcance real de la Preview

## Disponible para revisar

- Editor común para tarjetas por parada y pasaportes Lojano/Turista.
- Acceso desde la edición de una parada y el módulo Pasaporte.
- Sellos 1–30, límite diario 1–3, consumo mínimo, condiciones, repetición, fechas y participación en los dos pasaportes.
- Premios con texto, imagen HTTPS, cupos y días para canjear; catálogo por modalidad con aliado y parada de entrega.
- Metas gastronómicas y de alojamiento, selección de participantes, identificación de campaña y vista previa de tarjeta.
- Importación de la configuración vigente en memoria, sin escribir ni migrar datos reales.
- Propuestas locales separadas por cuenta; comparación de versión entre pestañas y copia de la propuesta anterior.

**Guardar propuesta no publica.** No se modificaron las reglas de Firestore, el Worker activo, los contadores, los premios emitidos ni la web del visitante. Las propuestas locales no se sincronizan entre dispositivos y pueden perderse si se borra el almacenamiento del navegador. La demo de tests usa memoria, sin Firebase.

## Límite que impide activar esto como configuración vigente

El sistema legado exige 10–30 visitas en el guardado y mínimo 10 en los servicios de confirmación. El pasaporte público y sus reglas de canje exigen exactamente seis sellos. Activar solo la interfaz produciría metas distintas a las que se validan y pondría en riesgo el progreso existente.

El servicio de referencia `lib/reward-programs-service.cjs` NO está expuesto como endpoint. Sus pruebas usan una base en memoria, no Firebase ni Cloudflare. Muestra transacciones, reserva de stock, un premio por pasaporte, permisos de entrega y snapshot de condiciones. No es una migración ni un servicio desplegado.

## Antes de publicar para clientes

1. Aislar un backend de pruebas y sus datos; no apuntar una Preview experimental al Worker activo.
2. Resolver la migración del progreso legado (incluido el origen verificado de sellos) y la renovación de ciclos con nueva versión, sin duplicar premios entre motores.
3. Conectar el editor a publicación versionada del servidor; validar permisos, usuarios y negocios de entrega. Mantener los borradores privados.
4. Conectar wallet/pasaporte a inscripciones y snapshots; reemplazar el canje legado solo tras activar de forma coordinada frontend, servicio y reglas.
5. Probar con cuentas de visitante y negocio: cambios de meta, canje simultáneo, agotamiento, vencimiento, reversión y renovación. Recién después habilitar el nuevo motor.

No activar una bandera manual ni copiar propuestas a producción para saltar estos pasos.
