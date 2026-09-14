# Plan maestro de pruebas finales — Vive Loja

> Documento interno y acumulativo. No forma parte visible de la web.
>
> Estado: en construcción. La revisión integral se ejecutará únicamente cuando el proyecto esté 100 % finalizado.

## Forma de uso

Cada nueva función debe registrarse aquí con:

- página y tipo de usuario;
- preparación necesaria;
- recorrido de prueba;
- resultado esperado;
- controles de seguridad;
- revisión en computadora y celular;
- evidencia y resultado final.

Estados: **Pendiente**, **En prueba**, **Aprobado**, **Requiere corrección**.

## 1. Acceso público y navegación

- [ ] Carga de la portada.
- [ ] Menú de computadora.
- [ ] Menú de celular.
- [ ] Cambio de idioma.
- [ ] Enlaces internos y externos.
- [ ] Ventanas, avisos y formularios.
- [ ] Estado sin conexión y recuperación de conexión.
- [ ] Instalación como aplicación web.
- [ ] Rendimiento y tiempos de carga.
- [ ] Accesibilidad básica: teclado, contraste, textos y botones.

## 2. Cuenta del visitante

- [ ] Ingreso con Google.
- [ ] Registro inicial del perfil.
- [ ] Ingreso posterior sin repetir el formulario.
- [ ] Cambio de cuenta.
- [ ] Cierre de sesión.
- [ ] Datos de turista y lojano.
- [ ] Mensajes cuando faltan datos o permisos.

## 3. Paradas, mapa y rutas

- [ ] Carga de todas las paradas publicadas.
- [ ] Categorías, búsqueda y filtros.
- [ ] Ficha de cada establecimiento.
- [ ] Dirección, horarios, contacto e imágenes.
- [ ] Marcadores y ubicación en el mapa.
- [ ] Guardado y planificación de ruta.
- [ ] Funcionamiento con GPS permitido y denegado.

## 4. QR y sellos del Pasaporte

- [ ] Generación de QR por parada desde administración.
- [ ] Lectura con cámara y apertura mediante enlace.
- [ ] Tiempo de carga después del escaneo.
- [ ] Identificación de usuario registrado.
- [ ] Registro correcto del sello.
- [ ] Rechazo del mismo sello para el mismo usuario.
- [ ] Rechazo de códigos alterados, vencidos o inválidos.
- [ ] Comportamiento con otro usuario.
- [ ] Método alternativo mediante PIN.
- [ ] Actualización inmediata del progreso.

## 5. Campañas del Pasaporte

- [ ] Activar y desactivar una campaña.
- [ ] Vigencia: antes, durante y después de las fechas.
- [ ] Identificador y nombre de campaña.
- [ ] Requisitos diferentes para turista y lojano.
- [ ] Progreso con paradas gastronómicas y hospedaje.
- [ ] Textos, imágenes y botones del premio.
- [ ] Asignación del negocio que entrega cada premio.
- [ ] Visualización del beneficio sin revelar inventario sensible.

## 6. Recompensas del Pasaporte

- [ ] Creación del código al completar el recorrido.
- [ ] Visualización del código por el visitante.
- [ ] Ingreso del negocio autorizado en merchant-rewards.html.
- [ ] Validación del código correcto.
- [ ] Registro de la entrega.
- [ ] Rechazo de un segundo canje.
- [ ] Rechazo por negocio no autorizado.
- [ ] Historial administrativo y disponibilidad interna.

## 7. Fidelidad por establecimiento

- [ ] Crear y editar un programa en gestion-fidelidad.html.
- [ ] Definir visitas mínimas, beneficio y vigencia.
- [ ] Activar y desactivar el programa.
- [ ] Autorizar la cuenta del negocio.
- [ ] Crear una solicitud segura de visita.
- [ ] Confirmarla desde confirmar-visitas.html.
- [ ] Impedir duplicados, reutilización y confirmaciones ajenas.
- [ ] Mostrar el progreso en fidelidad.html.
- [ ] Desbloquear el beneficio al alcanzar la meta.
- [ ] Canjearlo y registrar el historial.
- [ ] Reinicio o continuidad del ciclo, según configuración.

## 8. Portal y participación de negocios

- [ ] Página de planes.
- [ ] Formulario para sumar un negocio.
- [ ] Validaciones y envío de solicitud.
- [ ] Código de seguimiento.
- [ ] Consulta en estado-solicitud.html.
- [ ] Revisión, aprobación y rechazo desde administración.
- [ ] Suscripción, vencimiento y recordatorios.
- [ ] Permisos limitados para cuentas de negocios.

## 9. Contenidos y experiencias

- [ ] Tendencias y promociones.
- [ ] Historias de Loja.
- [ ] Emprendedores.
- [ ] Eventos y agenda.
- [ ] Podcast y audio.
- [ ] Loja en el Tiempo.
- [ ] Postales.
- [ ] Misiones de Chabaquito.
- [ ] Festival Internacional de Artes Vivas.
- [ ] Día Mundial del Turismo.
- [ ] Contadores automáticos y comportamiento al finalizar fechas.
- [ ] Botones para compartir.

## 10. Administración

- [ ] Inicio y restricción de acceso.
- [ ] Resumen general y respaldos.
- [ ] Usuarios registrados.
- [ ] Control de paradas.
- [ ] Estadísticas y reportes.
- [ ] Centro de QR y visibilidad de PIN.
- [ ] Gestión de contenidos.
- [ ] Pasaporte y premios.
- [ ] Planes y suscripciones.
- [ ] Gestión de fidelidad.
- [ ] Configuración general.
- [ ] Enlaces del sistema: copiar, abrir y clasificación.
- [ ] Estado de la web y modo en construcción.
- [ ] Aviso de cambios sin guardar.
- [ ] Funcionamiento en celular.

## 11. Firebase y seguridad

- [ ] Autenticación de visitantes, administradores y negocios.
- [ ] Reglas de Firestore publicadas.
- [ ] Reglas de Storage publicadas.
- [ ] Lecturas públicas estrictamente necesarias.
- [ ] Escrituras exclusivas por rol.
- [ ] Protección de datos de usuarios.
- [ ] Integridad de sellos, visitas, recompensas y canjes.
- [ ] Respaldo y restauración controlada.
- [ ] Errores de permisos comprensibles para el usuario.

## 12. Matriz final de dispositivos

Probar, como mínimo:

- [ ] Chrome en Windows.
- [ ] Chrome en Android.
- [ ] Safari en iPhone.
- [ ] Pantalla pequeña.
- [ ] Pantalla de escritorio.
- [ ] Internet rápido.
- [ ] Internet móvil lento.
- [ ] Cámara permitida y bloqueada.
- [ ] Sesión nueva y sesión previamente iniciada.

## 13. Registro de cambios que deberán probarse

| Fecha | Cambio | Archivos o páginas | Estado |
|---|---|---|---|
| 2026-09-14 | Directorio de enlaces del sistema | admin.html | Pendiente |
| 2026-09-14 | Campaña del Día Mundial del Turismo | index.html#dia-turismo | Pendiente |
| 2026-09-14 | Marca pública unificada como Vive Loja | Portada, administración y aplicación instalable | Pendiente |
| 2026-09-14 | Icono decorativo de máscaras en Artes Vivas | index.html#festival-live | Pendiente |
| 2026-09-14 | Centro administrativo de campañas, temas visuales y estados automáticos | admin.html, index.html y Firebase siteContent | Pendiente |
| Previo | Optimización de carga al sellar QR | Flujo de Pasaporte | Pendiente |
| Previo | PIN visible para administradores | Centro de QR | Pendiente |
| Previo | Fidelidad por negocio | fidelidad.html, confirmar-visitas.html y gestion-fidelidad.html | Pendiente |
| Previo | Validación de recompensas por negocios | merchant-rewards.html | Pendiente |

## 14. Criterio para declarar la web terminada

La web podrá considerarse lista cuando:

1. no queden funciones pendientes de implementación;
2. todas las pruebas críticas estén aprobadas;
3. los roles no puedan acceder a acciones ajenas;
4. QR, sellos, visitas y recompensas resistan intentos de duplicación;
5. la experiencia sea correcta en computadora y celular;
6. exista respaldo de Firebase;
7. el manual completo se regenere con el estado final de la plataforma.

## Incidencias finales

| Código | Módulo | Dispositivo | Pasos | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |
