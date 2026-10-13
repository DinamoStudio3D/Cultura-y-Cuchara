# Huellas de Loja — Documento de producto v1

Estado: propuesta de producto para revisión. No implica que las funciones estén implementadas.

## 1. Visión
Huellas de Loja es la experiencia personal de descubrimiento turístico dentro de VisitaLoja.com. El Pasaporte Digital conserva el registro verificable de visitas y sus reglas vigentes; Huellas de Loja presenta esas experiencias como historias, postales, rutas, colecciones y reconocimientos. No se crean dos cuentas ni dos escaneos.

## 2. Principios
1. Una visita verificada, múltiples efectos elegibles. Los efectos se calculan por reglas independientes, no se conceden automáticamente.
2. No se altera ni migra el progreso existente sin respaldo, pruebas y aprobación.
3. Una postal desbloqueada no es prueba de compra ni derecho a premio.
4. La interfaz distingue claramente “descubierto”, “visitado”, “validado” y “recompensa canjeada”.
5. Los negocios gestionan solo su información, sus beneficios y sus clientes autorizados; el administrador gestiona reglas globales.
6. Consentimiento explícito para notificaciones y marketing. Evitar exponer fechas de nacimiento, ubicación o visitas privadas.
7. Experiencias accesibles en móvil, bajo ancho de banda, y con alternativas a QR/cámara.

## 3. Modelo de producto
- **Mi recorrido**: resumen de actividad, siguientes experiencias sugeridas y logros recientes.
- **Mi pasaporte**: sellos, historial de visitas verificadas, reglas y progreso actual, conservando modos Lojano/Turista existentes.
- **Mi álbum**: postales con título, imagen autorizada, breve historia, cantón, fecha y estado de desbloqueo.
- **Mapa vivo**: los 16 cantones; estados por cantón según visitas verificadas, sin rastreo continuo de ubicación.
- **Aventuras con Chabaquito**: misiones independientes con reglas claras; se aprovecha el sistema de misiones ya existente.
- **Colecciones**: conjuntos de postales y visitas, p. ej. sabores, patrimonio, naturaleza; recompensas opcionales explícitas.
- **Beneficios**: tarjetas de fidelidad de cada negocio, independientes de los logros turísticos.
- **Mi privacidad**: configuración de perfil, compartición voluntaria de postales, preferencias de notificaciones.

## 4. Recorrido del visitante
1. En una ficha turística ve una historia breve, fotos reales y “Guardar para visitar”.
2. Elige una ruta o aventura. Puede consultar requisitos, lugares y progreso antes de comenzar.
3. En una parada con encargado escanea el QR y completa la confirmación autorizada existente; no se marca validado antes de confirmación.
4. El backend registra un evento idempotente y auditable. Si cumple requisitos, actualiza sello, aventura y colección.
5. El usuario ve un resumen de lo ganado y, si corresponde, una postal con contenido real del lugar.
6. El álbum y mapa reflejan la visita sin exigir escaneos adicionales.
7. En lugares sin encargado, se usan mecanismos de validación específicos aprobados (no un QR público ilimitado que dé recompensas por sí solo).
8. En negocios, la tarjeta de fidelidad aplica únicamente cuando se cumplan sus reglas; canjes requieren control antifraude.

## 5. Estados y reglas
- Visitante: anónimo explorando → autenticado → visita pendiente → visita confirmada → postal desbloqueada.
- Visita: pendiente | confirmada | rechazada | anulada. No contar pendientes como sellos.
- Postal: bloqueada | desbloqueada | retirada por corrección administrativa con registro.
- Aventura: disponible | en curso | completada | premio reclamado.
- Beneficio: disponible | reservado | canjeado | caducado.
- Cada regla debe definir elegibilidad, repetición, vencimiento, verificadores y auditoría.

## 6. Paneles de administración
### Administrador general
Catálogo de postales; colecciones; rutas y aventuras; reglas de desbloqueo; cantones; validación; auditoría; métricas agregadas; revisión de contenido; permisos; plantillas de notificación; configuración de privacidad.
### Dueño de negocio
Ficha, medios y horarios; campañas de fidelidad; reglas de recompensa dentro de permisos; validación de visitas autorizadas; estadísticas propias; mensajes promocionales solo a seguidores con consentimiento; promociones de cumpleaños con consentimiento y fechas de elegibilidad.

## 7. Arquitectura propuesta (a verificar contra código real)
- Mantener Firebase/Auth y el flujo actual de validación.
- Definir eventos de visita verificada con IDs únicos e idempotencia; no escribir desde el cliente resultados privilegiados.
- Derivar proyecciones de sellos, postales, aventuras y fidelidad por reglas separadas.
- Versionar reglas y contenido; registrar fuente, actor y fecha de cada validación.
- No duplicar PII en postales públicas; compartir una tarjeta visual sin datos sensibles.
- Migración progresiva y reversible, con feature flag y pruebas de regresión.

## 8. Diseño visual
- Dirección: cuaderno de viaje contemporáneo, postales editoriales y mapa ilustrado; sin aspecto de videojuego genérico.
- Fotografía auténtica de Loja y provincia, tipografía editorial legible, colores de la marca, detalles culturales tratados con respeto.
- Inicio: portada inmersiva, progreso real, “próxima huella”, colección destacada.
- Pasaporte: aspecto de libreta con sellos, pero navegación accesible y estados inequívocos.
- Álbum: tarjetas postales que se pueden abrir para leer historias; versiones bloqueadas sin revelar premios.
- Mapa: vista de cantones real y lista alternativa accesible.
- Chabaquito: personaje y misiones vinculadas, sin reemplazar su sistema actual.

## 9. Plan por entregas
**Fase A — Producto y experiencia:** mapa de pantallas, flujos completos, diseño visual de alta fidelidad, textos, accesibilidad, estados vacíos y errores. Aprobación antes de integrar datos.
**Fase B — Integración segura:** lectura del pasaporte existente, sesión, historial verificado y proyecciones de álbum; sin modificar reglas de recompensas.
**Fase C — Contenido y descubrimiento:** editor de postales, colecciones y mapa de 16 cantones, historias verificadas.
**Fase D — Aventuras y fidelidad:** eventos idempotentes, integración de misiones, reglas de beneficios, canjes y auditoría.
**Fase E — Comunicaciones:** preferencias, consentimiento, campañas, cumpleaños, límites de envío y métricas.
**Fase F — Lanzamiento:** pruebas móviles, seguridad, carga, restauración, piloto con negocios y lanzamiento gradual.

## 10. Métricas de éxito
Activación (primer recuerdo), porcentaje de visitas confirmadas, tasa de finalización de rutas, retorno voluntario, participación por cantón, visitas a negocios y canjes válidos; todo agregado y respetando privacidad.

## 11. Decisiones pendientes
- Nombre comercial definitivo y subtítulo.
- Qué logros son turísticos y cuáles comerciales.
- Primeras 2–3 colecciones piloto y postales reales con permisos.
- Política de visitas sin encargado y validación antifraude.
- Reglas de puntos actuales a preservar.
- Requisitos para compartir postales y usar datos de cumpleaños.
- Identidad gráfica oficial de Chabaquito y activos de marca.
