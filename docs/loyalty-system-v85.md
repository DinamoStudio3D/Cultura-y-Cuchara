# V85 — integración administrativa y filtros del portal

- Administrador: módulo Fidelidad por negocio reutiliza gestion-fidelidad en un iframe del mismo origen, cargado al abrirlo. El modo integrado usa la aplicación Firebase viveLojaAdmin y persistencia SESSION del panel; mantiene la comprobación de autorización propia. La página independiente conserva su aplicación predeterminada.
- Propietario: fechas inclusivas en hora de Ecuador, combinadas con la retención del plan. Estadísticas y CSV usan el mismo filtro; clientes frecuentes conservan su progreso acumulado. Rangos invertidos no muestran métricas y deshabilitan CSV.
- Cargas del portal invalidan respuestas de cuentas anteriores. Los negocios siguen limitados a las asignaciones autorizadas y capacidades del plan. CSV neutraliza prefijos de fórmula.
- Validación: validate-site, pruebas existentes de sesión administrativa, seguridad y puntos, y pruebas de límites de fechas sobre la función real. Sin comprobación visual ni Firebase real.
- Pendiente: separar gestión del bloqueo por plan sin ampliar permisos, integración completa de promociones/cumpleaños y prueba del acceso compartido en navegador. Puntos V83/V84 continúan sin desplegar ni activar; no se modificaron datos, Functions ni reglas.
