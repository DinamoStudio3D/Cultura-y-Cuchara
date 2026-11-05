# Prueba móvil del Centro de Recompensas

Usar únicamente un proyecto Firebase separado y vacío para los datos de recompensas. La autenticación del panel actual conserva las cuentas existentes de VisitaLoja. Elegir cuatro cuentas de prueba existentes con los accesos de la interfaz que correspondan y una parada ya visible para el propietario, el encargado y administración. El script copia únicamente los identificadores y prepara los permisos de la API en el proyecto separado. La campaña y las visitas de prueba se crean allí.

Crear un archivo local fuera del repositorio con esta estructura y apuntar `REWARDS_QA_FIXTURE_FILE` a su ruta:

```json
{"admin":"UID_ADMIN","owner":"UID_PROPIETARIO","staff":"UID_ENCARGADO","customer":"UID_CLIENTE","placeId":"ID_PARADA"}
```

El comando requiere las variables `REWARDS_PREVIEW_FIREBASE_PROJECT` y `REWARDS_PREVIEW_FIREBASE_ACCOUNT` configuradas fuera del repositorio. No compartir la credencial en el chat ni en GitHub. El comando requiere autorización para escribir en ese proyecto.

```sh
node tests/firestore-rules/rewards-mobile-fixtures.cjs --apply ID_DEL_PROYECTO
```

Tras preparar los datos, configurar esas dos variables y `REWARDS_DRAFT_WRITES=approved-preview-v1` solo en Vercel Preview para `feature/rewards-center-web-v1`. Generar un Preview de esa rama y usar la misma dirección durante todas las sesiones. Los datos de prueba se consultan exclusivamente a través de la API de recompensas. El script no habilita variables en Vercel ni publica reglas.

1. Propietario. Abrir Mi negocio, elegir la parada y crear un premio con 10 sellos y un cupo. Guardar en remoto y enviar a revisión.
2. Administración. Consultar la bandeja, aprobar, publicar y copiar el enlace de recompensas de la parada.
3. Cliente. Abrir el enlace, reclamar y copiar la referencia. Recargar y repetir para comprobar que conserva la misma referencia.
4. Encargado. En la parada asignada, validar la referencia y repetir. La segunda confirmación debe indicar que el premio ya se entregó.
5. Administración. Publicar un premio patrocinado de pasaporte con meta de dos paradas y copiar el enlace. El cliente debe poder reclamarlo una vez. El encargado debe poder entregarlo en la parada patrocinadora. Repetir con un premio general y confirmar que su entrega corresponde a administración.
6. Confirmar en el Firebase separado que los dos sellos de pasaporte permanecen intactos y que cada premio tiene un único canje por cuenta.
