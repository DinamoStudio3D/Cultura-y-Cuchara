# V86 — espacio del propietario por negocio

Todos los negocios asignados y existentes aparecen en tarjetas de gestión. Al seleccionar uno se sincronizan el filtro principal y los selectores de puntos, campaña publicada y borradores de cumpleaños.

La lista de negocios de gestión se separa de la lista con estadísticas habilitadas. Solo los segundos generan consultas de clientes, visitas, recompensas e interacciones. El panel y el CSV quedan ocultos o bloqueados cuando la selección no tiene métricas disponibles. Los períodos y fechas siguen aplicándose. Las estadísticas conjuntas indican los negocios excluidos por plan.

Un fallo de consulta de una sección no bloquea los borradores de las demás. Guardar una campaña de cumpleaños publicada requiere haber cargado su configuración actual; se bloquea tras un fallo de lectura. Las respuestas y mensajes de guardado de sesiones anteriores se descartan. Cambiar de cuenta limpia también los elementos visibles, además de los arrays.

Pruebas con servicios simulados ejecutan la función real de carga: planes mixtos, negocios sin estadísticas, fallos de cumpleaños y respuestas posteriores a cerrar sesión. No se usaron datos reales para probar guardados. No se desplegaron Functions ni reglas. Los puntos, seguidores y notificaciones siguen pendientes de activación e integración; los borradores no publican ni envían avisos. La campaña publicada conserva su guardado existente en Firestore sujeto a las reglas; no incluye los tres momentos del borrador.

Pendiente: revisión visual y de sesión real, validación en Firebase aislado, promociones y notificaciones completas.
