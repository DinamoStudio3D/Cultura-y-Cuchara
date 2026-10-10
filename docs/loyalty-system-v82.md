# V82 — cuentas de negocios

Base c877670, rama design/modernizacion-web-v1.

Administrador / Paradas: formulario separado de creación administrativa, nombre del negocio/responsable, correo, contraseña inicial de al menos 8 caracteres y selección múltiple de paradas. La sesión secundaria exclusiva de negocios espera Persistence.NONE antes de crear. Se comprueba autorización administrativa antes y después de crear; la escritura usa la sesión administrativa y una transacción que rechaza documentos existentes. No concede roles ni campañas adicionales.

El acceso queda en missionRewardMerchants/{uid}, active y placeIds. No almacena contraseñas en Firestore, logs ni borradores. El campo se limpia al enviar; la sesión secundaria se cierra incluso ante error. No elimina cuentas automáticamente. Un error después de crear informa resultado parcial y UID; nunca anuncia éxito completo.

Correo existente / recuperación: no se cambia contraseña ni se sobrescriben cuentas. El propietario ingresa en merchant-rewards.html con su método existente; ese portal ya registra una solicitud vinculada al UID autenticado. El administrador verifica identidad/correo, usa la autorización existente de Chabaquito para la campaña correspondiente, y asigna paradas mediante Gestión de fidelidad. Este flujo requiere intervención administrativa; V82 no añade búsqueda de usuarios por correo ni una recuperación automática.

merchant-dashboard.html y confirmar-visitas.html: ingreso por correo y contraseña además de Google, mensajes de error, bloqueo de doble envío y limpieza del campo de contraseña. Continúan utilizando la comprobación existente de active/placeIds. La pantalla pendiente muestra UID para revisión.

Validación: 10 pruebas nuevas simuladas (sesión aislada, datos sin secretos/rol, permisos denegados, parada inválida, contraseña débil, fallo de persistencia, correo existente, asignación fallida, cambio de sesión, colisión de documento y ambos métodos de ingreso). Suite focalizada con seguridad administrativa y cumpleaños: 15/15. Backend: 77/77. Sintaxis de los scripts de las tres páginas, validate-site y git diff --check correctos. No se realizó prueba visual en navegador ni creación/login de cuentas reales. No certifica reglas desplegadas ni habilitación del proveedor Email/Password en Firebase; si está deshabilitado, la operación mostrará error.

Sin cambios de reglas, main, producción o datos reales. Seguidores, avisos y push siguen pendientes como en V81.
