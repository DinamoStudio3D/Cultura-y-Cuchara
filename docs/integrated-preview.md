# Visita Loja — Preview integrada

Rama: `feature/visitaloja-integrada-preview`. Base: `956a470f3b893cca00e9cc88d179719b1a00541d`.

## Integración selectiva

- Conserva Admin V2, QR estáticos/dinámicos existentes, Fidelidad, Pasaporte, Rutas, aventura y ranking demostrativo de la base Chabaquito.
- Reúne los cambios visuales de eventos y Marcas Aliadas hasta `44f988a63a801c58911fd98f99e5cdebb08c5294`.
- Reutiliza organización de Paradas, interfaz de accesos y mejoras del portal de imágenes del estado Cloudinary `1a2eb70a27659c3538463560f3e7393ab39ff265`, conservando Firebase como proveedor. No importa la activación Cloudinary ni los endpoints Functions/self-check-in de esa rama.
- No importa la antigua persistencia `chabaquito-v1-persistence.js`, ni reemplaza el motor unificado de evidencias/XP.
- No modifica ni publica Firestore Rules. El panel de accesos no equivale a tener reglas/permisos habilitados; las reglas aisladas actuales deniegan cambios en `businessAccess`.

## Configuración antes de publicar Preview

En Vercel, únicamente Preview y esta rama:

- `VISITALOJA_FIREBASE_PROJECT_ID=visitaloja-chabaquito-preview`
- `VISITALOJA_FIREBASE_WEB_CONFIG`: configuración pública de la app aislada existente.
- `CHABAQUITO_V1_ENABLED=false`

No copiar credenciales administrativas de producción. Si falta configuración, la web bloquea Firebase; nunca usa producción como alternativa. Tanto firma como limpieza Cloudinary están bloqueadas en Preview antes de llamadas externas.

## Límites actuales

Esta integración de código no activa visitas/XP reales. Ranking y aventura mantienen su condición demostrativa. No incluye rediseños nuevos, migraciones, Functions ni activación de servicios. El Firebase aislado solo contiene dos paradas ficticias en borrador: no mostrará automáticamente los negocios, eventos y marcas de producción. Hace falta contenido ficticio autorizado para comprobar esos componentes con datos, sin copiar la base real.

## Verificación

Suites existentes de Chabaquito, QR e imágenes; validación general del sitio; prueba de integración con referencias JS/HTML, assets, navegación con cambios pendientes, persistencia única, proveedor Firebase y bloqueo Cloudinary. Inspección visual del deployment queda pendiente hasta publicar la rama y configurar sus variables.
