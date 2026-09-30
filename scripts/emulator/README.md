# Pruebas locales de Chabaquito

Solo Firestore Emulator en 127.0.0.1:8787, proyecto ficticio demo-visitaloja-chabaquito. No hay despliegue ni endpoint nuevo. El arranque usa bootstrap.rules (denegación total) y el test carga las reglas actuales del repositorio sin modificarlas. El test rechaza credenciales de cuenta de servicio y cualquier otro host antes de importar SDKs.

Requisitos: Node, Java17, herramientas de desarrollo instaladas fuera del repositorio:

```sh
npm install --prefix /tmp/visitaloja-emulator-tools firebase-tools@13.35.1 firebase-admin@13.4.0 @firebase/rules-unit-testing@4.0.1 firebase@11.10.0
```

Desde la raíz del repositorio, en un entorno sin credenciales reales:

```sh
NODE_PATH=/tmp/visitaloja-emulator-tools/node_modules node /tmp/visitaloja-emulator-tools/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only firestore --project demo-visitaloja-chabaquito --config scripts/emulator/firebase.json "node scripts/emulator/chabaquito.test.cjs"
```

La configuración solo inicia Firestore. Las fixtures y limpieza afectan exclusivamente a la base demo del emulador. Admin SDK simula backend y siembra fixtures; SDK cliente autenticado prueba las reglas. La reversión se simula modificando la fuente con Admin SDK local: no certifica la transacción comercial completa de reversión.

Se prueban escritura XP denegada, privacidad, permisos por parada, confirmación mediante batch cliente, 10 transacciones concurrentes, ambos métodos y reversión idempotente. La prueba negativa exige que crear una visita sin confirmar su código sea rechazado. Las reglas probadas son las locales del repositorio, no se consultan ni se publican las de producción.

Las reglas actuales deniegan también lectura directa de perfiles Chabaquito al propietario. Las lecturas reales futuras deben usar API autorizada o nuevas reglas cuidadosamente preparadas en otra fase. No se publican reglas aquí.


Resultado previo al refuerzo: seis comprobaciones de integración pasan contra Firestore Emulator real. Las 11 suites originales,14 pruebas de descubrimientos y9 pruebas del adaptador también pasan. La primera ejecución falló por una fixture numérica de caducidad; se corrigió a Timestamp. El CLI no permite referenciar reglas fuera de su directorio de proyecto; bootstrap.rules evita abrir acceso durante el arranque y el test inyecta expresamente firestore.rules mediante initializeTestEnvironment.

El riesgo original de crear loyaltyVisits sin confirmar el código fue reproducido y después corregido localmente en la fase descrita abajo. No se desplegaron reglas. Este resultado no autoriza producción.


## Refuerzo local de loyaltyVisits

La creación ahora requiere código previamente pendiente/vigente y código confirmado después de la operación, mismo usuario/parada/encargado y timestamp de confirmación. No se cambian las reglas de actualización/reversión ni otras colecciones. El batch positivo incluye contador de fidelidad y sello de Pasaporte. Se rechazan visitas aisladas y estados pendientes. No hay despliegue; no equivale a revisar todos los caminos de premios comerciales ni a confirmar reglas de producción.
