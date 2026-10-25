# Pruebas locales de reglas de recompensas

Este bloque usa el emulador Firestore en `127.0.0.1:8089` y el identificador ficticio `demo-visitaloja-rules`. No necesita login, credenciales de servicio ni un proyecto real de Firebase. El archivo de pruebas rechaza cualquier otro destino.

Desde la raíz del repositorio, con Node y Java instalados:

```sh
npm install --prefix tests/firestore-rules --no-audit --no-fund
tests/firestore-rules/node_modules/.bin/firebase emulators:exec --project demo-visitaloja-rules --only firestore --config firebase.rules-test.json 'node --test tests/firestore-rules/rewards.test.cjs'
```

La versión de herramientas está fijada para el entorno Java 17 utilizado en esta validación. Las versiones futuras de Firebase CLI pueden requerir Java 21. Las dependencias de este bloque no se agregan al paquete de producción.

Los 18 casos comprueban acceso del cliente, negocio elegido, otro negocio, cuenta suspendida y administrador; elección inmutable; registro directo de canjes denegado; entrega única; permisos de canjes antiguos; bloqueo de anulación de visitas utilizadas en premios; y rechazo de entrega de premios de fidelidad vencidos o sin vigencia comprobable.

El administrador conserva sus permisos de corrección. No son pruebas del Worker desplegado, del navegador ni de las credenciales reales. No usar `firebase deploy` como parte de estas comprobaciones.
