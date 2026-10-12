# V219 — Primera revisión integral de VisitaLoja

## Alcance y evidencia
Revisión del código del administrador, portal de negocios, fidelidad del cliente y páginas públicas. Este inventario describe implementaciones y pendientes; no certifica su funcionamiento en producción. Se conservaron los formularios, identidades, permisos y operaciones existentes. No se activaron servicios, enviaron avisos ni modificaron cuentas reales.

## Inventario por espacio

| Espacio | Implementación encontrada | Estado comprobado | Pendiente y siguiente intervención |
| --- | --- | --- | --- |
| Administrador — `admin.html` | Módulos de paradas, cantones, cuentas de negocios, usuarios, fidelidad, QR, eventos, misiones, pasaporte, suscripciones, contenido y configuración. | Existen módulos y pruebas de navegación; cuentas de negocios se separaron en V217. | Agrupar navegación por tarea; separar operación cotidiana, contenido y configuración. Revisar visibilidad y guardado con sesión administrativa. |
| Supervisión de fidelidad — `gestion-fidelidad.html` | Visitas y premios existentes, estudios de puntos, promociones, cumpleaños y avisos. | Consolas compartidas con controles por rol; pruebas locales de sesión y autorización. | Separar registros existentes de servicios pendientes y borradores, reutilizando los mismos componentes. Validar permisos reales por parada. |
| Propietario — `merchant-dashboard.html` | Ocho apartados en V218, filtros por parada, resultados según plan, enlace a edición de ficha. | Navegación probada sin sustituir formularios; el usuario confirma mejor organización. | Plegar simulación de puntos; reducir identificadores y lenguaje técnico; explicar cada acción de guardado/publicación. |
| Ficha del propietario — `mi-negocio/`, `merchant-profile.html` | Edición de datos e imágenes aparte del portal de gestión. | Hay rutas y controles existentes. | Verificar recorrido desde portal, conflictos, imágenes y acceso de cuenta limitada. Unificar presentación sin duplicar formularios. |
| Acceso de negocio — `js/merchant-access.js` | Correo/contraseña y Google, creación administrativa con autenticación secundaria y asignación de paradas. | Acceso del propietario confirmado por el usuario; pruebas locales de asignación. | Añadir recuperación de contraseña; probar cuenta inactiva, acceso revocado y denegación entre negocios con sesiones reales. |
| Cliente — `fidelidad.html` | Tarjetas, historial, QR temporal, cumpleaños, avisos y estudio de puntos dentro de la cartera. | Pruebas de renderizado, aislamiento de sesión y acciones explícitas. | Priorizar tarjetas reales; separar puntos en preparación y ejemplos; ordenar perfil, pasaporte y recompensas mediante enlaces a herramientas existentes. |
| Validación — `confirmar-visitas.html`, `merchant-rewards.html` | Flujos distintos para confirmar visitas y retirar premios. | Existen endpoints y comprobaciones de negocio asignado en `functions/index.js`. | Comprobar QR vencido, reutilizado, negocio incorrecto y doble clic en un recorrido real controlado. |
| Pública — `index.html`, `cantones.html`, `canton.html`, `negocio.html`, `tienda.html` | Mapa, fichas, cantones, comercio y contenido turístico; paleta azul compartida. | Pruebas de contraste declarado, navegación, diálogos, direcciones y contenido. | Revisión visual de móvil/escritorio, texto largo y superposición; contrastar enlaces y presencia de tienda/cantones sin repetir contenido. |

## Hallazgos y corrección V219

1. Los estudios de puntos y avisos mostraban `error.message` para fallos técnicos. Una lectura con `functions/internal` terminaba enseñando «internal» a los tres roles. Se añadió `js/service-errors-v219.js`, cargado antes de ambas herramientas en sus tres páginas.
2. Se distinguen servicio ausente, consulta temporalmente fallida, permiso denegado, sesión vencida y límite del servicio. Los mensajes útiles de validación de negocio se conservan; códigos desconocidos y fallos internos no muestran detalles del servidor.
3. Una escritura cuyo resultado es incierto indica consultar el estado antes de reintentar. No declara que nada se guardó ni repite automáticamente una operación.
4. Otros módulos administrativos aún tienen rutas que presentan mensajes de error directamente. Deben revisarse por operación: una validación de imagen o un conflicto de datos requiere instrucciones distintas de una falla técnica. Esta versión no afirma haber resuelto todos los errores del sitio.
5. Los ejemplos de puntos y las herramientas en preparación siguen presentes. Etiquetarlos no demuestra que el servicio esté activado. Deben quedar separados del uso cotidiano en los próximos rediseños.

## Orden de trabajo

1. Administrador: navegación por tareas y separación de configuración/supervisión de fidelidad; preservar IDs, formularios y restricciones.
2. Propietario y cliente: separar pruebas de operaciones reales; recuperar contraseña y unificar recorridos entre portal, ficha, tarjetas y premios.
3. Funcionamiento: validar cuentas y límites entre paradas; después puntos, consentimiento, promociones y cumpleaños. No activar notificaciones antes de comprobar autorización, límites e idempotencia.
4. Visual: revisar recorridos completos en móvil/escritorio con sesiones representativas, campos largos, errores, menús y contenido vacío.

## Validación de esta versión
257 pruebas de scripts aprobadas y validador del sitio correcto. Incluye fallos `internal` de avisos para administrador, propietario y cliente; ausencia de servicio; conservación de permisos; escritura incierta y validación de stock. Los endpoints de estas pruebas están simulados. No se realizó inspección visual en navegador ni prueba de servicios desplegados con sesiones reales. Publicación limitada a Preview en la rama de desarrollo.
