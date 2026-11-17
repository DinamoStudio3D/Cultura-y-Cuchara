# Estado de implementación Android 0.83

Este inventario distingue la experiencia pública de los editores administrativos. No certifica funcionamiento en teléfono ni cobertura completa ES/EN. La referencia histórica PORT_PARITY_AUDIT.md contiene avances acumulados; sus primeras listas corresponden a versiones anteriores.

## Cerrado en esta entrega

Crear cuenta de responsable con correo y contraseña desde Accesos de negocios. Conserva la sesión principal; la cuenta comienza pausada, sin paradas y sin privilegios administrativos. La asignación y activación usan la herramienta existente. No crea cuentas reales durante desarrollo ni envía correos.

## Administración nativa implementada

- Paradas: crear y editar ficha, ubicación, contacto, medios y publicación.
- Eventos generales: crear, editar y publicar.
- Fidelidad por negocio: programa normal y temporadas.
- Directorio de usuarios, permisos administrativos e historial de auditoría.
- Asignación de negocios a propietarios y encargados; crear cuentas de responsables.
- Campañas de notificación y prueba dirigida autorizada.
- Portal de propietario/encargado: operaciones de visitas, clientes y premios y edición autorizada de ficha.

## Herramientas web sin editor nativo equivalente localizado

Comparación de `admin.html` con los puntos de entrada administrativos de Android:

| Grupo | Pendientes concretos |
| --- | --- |
| Guías y contenido | Editor de cantones y rutas; historias; emprendedores; fotografías históricas; postales; podcast |
| Portada y plataforma | Configuración de portada/identidad y bloques; música y video destacados; aliados/marcas; enlaces y mantenimiento |
| Negocios | Catálogo/asignación comercial de planes y suscripciones; editor avanzado de QR/menús y beneficios comerciales |
| Misiones y pasaporte | Editores de misiones Chabaquito, configuración de pasaporte y administración general del centro de recompensas; revisión/gestión de solicitudes de campañas |
| Gestión global | Tableros de control, estadísticas y herramientas de supervisión global; edición/importación masiva de programación de festival |
| Idioma | Selección y textos ES/EN en toda la experiencia, con respaldo para contenido sin traducir |

Que un contenido pueda consultarse públicamente en Android no significa que su editor ya esté migrado. Las opciones específicas dentro de cada editor deben compararse al implementar su módulo: este inventario no declara equivalencia campo por campo. SEO/sitemap siguen perteneciendo a la web.

## Cierre posterior

Pruebas de usuario y revisión en dispositivos al final, como pidió el usuario. Después: configuración de producción, firma de distribución, App Links y publicación Android. No declarar iOS terminado por entregar una APK.
