# Preparación aislada — no se ha desplegado ni sembrado nada

Destino único: visitaloja-chabaquito-preview (Spark). Se mantiene intacto cultura-y-cuchara.

## Vercel

Añadir solamente a Preview, filtrado por rama feature/chabaquito-v1:

- VISITALOJA_FIREBASE_PROJECT_ID=visitaloja-chabaquito-preview
- VISITALOJA_FIREBASE_WEB_CONFIG: objeto JSON público copiado de Firebase > Configuración del proyecto > General > Tu app Web > Configuración SDK. Campos: apiKey, authDomain, projectId, storageBucket si existe, messagingSenderId, appId y opcional measurementId. No incluir private_key/client_email ni credenciales Admin.
- CHABAQUITO_V1_ENABLED=false hasta autorizar endpoint/datos reales de PRUEBAS.

VERCEL_ENV y VERCEL_GIT_COMMIT_REF son variables de Vercel; no sobrescribirlas. El endpoint /api/firebase-web-config devuelve solo configuración Web permitida, sin caché. Cada página resuelve su configuración antes de inicializar sus apps actuales. Preview mal configurada se bloquea; no usa la configuración real como fallback. Producción conservaría la configuración actual, aunque no se modifica ni despliega producción en esta fase.

No se necesitan credenciales Admin para revisar Admin mediante SDK cliente. Para el backend XP futuro, FIREBASE_SERVICE_ACCOUNT_JSON deberá pertenecer exclusivamente al proyecto Preview y estar solo en esa rama/entorno: el servidor rechaza claves de cultura-y-cuchara antes de inicializar o usar la caché. No pegar esas credenciales en chat ni Git. Subidas Cloudinary quedan bloqueadas en Preview; no se cambia su implementación ni activación.

## Reglas

Preparar las reglas actuales firestore.rules; el refuerzo loyaltyVisits ya pasó emulador. No se despliegan aquí. Antes de publicar verificar explícitamente proyecto seleccionado en consola y en CLI; el futuro comando deberá incluir --project visitaloja-chabaquito-preview, nunca depender de .firebaserc (que sigue indicando producción). La configuración Web no cambia el destino de Firebase CLI.

Permisos Admin deben asignarse mediante adminUsers/{TEST_ADMIN_UID} dentro del Firebase aislado, tras verificar el UID del usuario ficticio. No basta crear un usuario Auth para que sea administrador. El perfil Chabaquito continúa denegado a clientes por reglas actuales; su lectura será mediante API autorizada. No activar reglas abiertas/test mode.

## Fixtures preparadas

fixtures.json contiene dos paradas ficticias, QR existentes compatibles, perfil Admin y asignación de encargado. No se ha copiado ni leído la base real. Sustituir UIDs placeholders y PREVIEW_ORIGIN solo después de comprobar el destino. Coordenadas ilustrativas: no representan una parada real de pruebas; antes de prueba física sustituirlas por un punto acordado, únicamente en Firebase Preview. No hay script que escriba automáticamente estos documentos.

## Pendiente antes de teléfono

Valores públicos Web, configuración Vercel, publicar commits mediante vía autorizada, autorización separada de reglas/datos Preview, usuarios ficticios con roles. Inicio/confirmar-visitas aún usan Google: preparar login correo/contraseña de pruebas. Preparar endpoint del adaptador de visitas, sin Functions/Blaze. Los generadores actuales siguen usando dominio público canónico; QR de pruebas deberán usar URL Preview explícita antes de imprimir, sin tocar QR de producción. Este commit aísla el destino Firebase de las páginas/APIs, no constituye un flujo QR ya operativo.

No publicar Preview, desplegar reglas ni crear datos hasta verificar esa configuración y recibir autorización.
