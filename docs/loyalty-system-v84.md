# V84 — Catálogo editable y continuidad durante pausas

Base V83 5e4c2de. Rama design/modernizacion-web-v1.

## Cambios

- El editor local conserva hasta 100 beneficios por cuenta/parada. Nuevo beneficio, editar y eliminar borrador son operaciones locales explícitas. Guardar un beneficio no borra los demás. Se conserva la recuperación del último borrador V83; no hay migración automática ni escritura al abrir la página. Si el catálogo está dañado no se reemplaza silenciosamente.
- En servicio habilitado, administrador/dueño pueden cargar un beneficio publicado al formulario y editarlo. No se publica hasta pulsar Publicar beneficio. Si admin no permitió ownerCanConfigure, el dueño no recibe botones habilitados de publicación. Tasa máxima viene del servidor; el límite administrativo local sigue siendo un borrador, no un ajuste global.
- Clientes pueden consultar saldo, movimientos, preferencias y reservas con la plataforma pausada. Dueños/admin autorizados pueden consultar catálogo, conteos y reservas durante pausa. Cancelar una reserva pendiente y devolver puntos sigue siendo posible desde interfaz; también dejar de seguir. La pausa conserva bloqueados otorgamientos, nuevas reservas, entrega, configuración y nuevos seguimientos. La ausencia de configuración global se trata como paused, nunca como enabled.
- Dueño/admin tienen Cancelar reserva y devolver puntos además de Confirmar entrega. El backend existente comprueba pertenencia y estado; V84 no permite cancelar canjes entregados.
- Error de stock, permisos o saldo conserva su explicación. Ya no se etiqueta todo failed-precondition como servicio ausente. Solo fallos de consulta not-found/unavailable reciben el mensaje de preparación del servicio.
- admin.html y gestion-fidelidad.html reutilizan una misma comprobación de acceso administrativa (js/admin-access-check.js): identidad propietaria existente, claims admin/owner o adminUsers activo. No se crean roles ni se cambian reglas. La gestión antes admitía solo el correo propietario, aunque las reglas locales ya reconocían otros administradores.
- Al cerrar/cambiar sesión en gestión se oculta el panel, se limpian datos/listados y se descartan respuestas anteriores, tanto de autorización como de carga. Los roles de backend permanecen obligatorios; esta comprobación de interfaz no concede permisos Firebase.
- Cache de interfaz de puntos actualizada a v=84 en las tres páginas.

## Estado real

Preview publica la web; NO despliega Cloud Functions ni activa puntos o seguidores reales. El catálogo editable visible sin servicio es de borradores locales. Las mejoras de pausa y edición del catálogo publicado se comprobaron con APIs simuladas y están preparadas para el futuro servicio Firebase.

No se modificaron main, reglas, usuarios, datos reales o producción. No se crearon promociones generales, bandeja de avisos ni envíos automáticos en esta fase.

## Verificación

- Backend: 98/98 (2 nuevos de consultas/cancelaciones durante pausa y privacidad). Continúan los 19 tests V83 y 77 originales.
- Focalizados interfaz/seguridad: 28/28. Incluyen 9 contratos de interfaz de puntos, 2 de acceso administrativo compartido y 2 del bloque real de sesión/carga de gestion-fidelidad ejecutado con proveedores simulados.
- Pruebas de catálogo: varios beneficios, edición sin publicación, eliminación local, aislamiento de parada/cuenta, tasa limitada por servidor, pausa de canjes y conservación del mensaje de stock.
- Sintaxis de scripts inline de cuatro páginas, JS de servicio/interfaz/helper, validate-site y git diff --check correctos.
- Sin navegador/layout QA: herramienta control-browser no disponible en el entorno administrado. Sin emulador: Firebase CLI no disponible. Los tests transaccionales/DOM aislados no sustituyen un SDK real ni un emulador.

## Revisión de la Preview

En gestion-fidelidad.html ingresar como administrador autorizado, ir al apartado Puntos por negocio y seleccionar una parada. Preparar y guardar un primer borrador, pulsar Nuevo beneficio, guardar un segundo y editar/eliminar uno desde Catálogo de borradores. Comprobar que el otro permanece. Estos botones no publican recompensas ni generan puntos.

Consultar servicio es lectura explícita; si V83 no está desplegado informará que está pendiente. No usar las funciones preexistentes de guardar programa, asignar paradas o confirmar visitas para esta revisión, pues conservan su conexión real previa.

## Pendiente antes de activación

QA visual móvil/escritorio, SDK/emulador e índices, proyecto de prueba autorizado, despliegue explícito de Functions, validación integral y autorización para activar configuración. Se mantienen los límites de planes del portal de negocios, ausencia de paginación de consultas y de ajustes administrativos de saldo documentados en V83. Seguidores/puntos permanecen en preparación, no operativos en producción.
