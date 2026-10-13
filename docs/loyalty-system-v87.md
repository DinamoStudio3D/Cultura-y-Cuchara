# V87 — promociones locales por negocio

Se añade un estudio compartido de promociones al portal del propietario y a Gestión de fidelidad, incluido el módulo integrado del administrador. El selector principal del propietario sincroniza también el negocio de la promoción.

Cada cuenta, rol y negocio conserva hasta 50 borradores locales. Crear, editar, eliminar y previsualizar no consulta Firebase, no publica beneficios y no envía notificaciones. Cambiar de negocio, cuenta o asignaciones limpia el editor y la vista previa. Una actualización de métricas conserva el texto sin guardar si la cuenta y el negocio siguen siendo los mismos. Los datos locales inválidos no se sobrescriben.

Los borradores incluyen título, mensaje, condiciones y una ventana opcional con inicio y fin en hora de Ecuador. Se rechazan fechas inexistentes, ventanas incompletas e inicio posterior o igual al fin. Las etiquetas de fechas describen el borrador; no indican publicación o envío programado.

La política de público usa el modelo de seguidores V83: mismo negocio, active=true y promotions=true. Es una comprobación pura para la preparación futura; no lee seguidores ni estima destinatarios. El canal previsto es inApp y no se habilita push. La vista previa usa textos del editor y ninguna identidad real.

Validación: pruebas de fechas, consentimiento, catálogo, cambio de cuenta/negocio, contenido HTML como texto, errores de almacenamiento y asignaciones retiradas. DOM simulado, sin revisión visual en navegador. Sin cambios a Functions, reglas, datos reales ni producción. Pendientes: publicación, entrega idempotente, controles de campaña en servidor, notificaciones y prueba en Firebase aislado.
