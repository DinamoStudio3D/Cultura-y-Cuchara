# V90 — Cantones en páginas independientes

Descubrir → Cantones de Loja navega a `cantones.html` desde escritorio y móvil. La portada ya no contiene el directorio V89. Cada una de las 16 tarjetas abre `canton.html?canton=<id>` y puede compartirse como enlace independiente.

Las fichas consultan `locales` por `cantonId`, usando el catálogo compartido de Administración. Solo muestran lugares públicos activos, sin inferir asignación por dirección; mantienen la exclusión pública de moteles. Las descripciones, direcciones y asignaciones se administran en Paradas y negocios. Cada lugar abre su ficha existente en `/?lugar=<id>`.

La página diferencia carga fallida, cantón inválido y ausencia de publicaciones, con reintento y regreso al selector. No crea contenido turístico ficticio. No se escriben datos, reglas ni funciones.

Validación: pruebas de rutas, selector, consulta y estados con DOM/Firestore simulados; validación estática. Revisión visual y acceso real a Firestore pendientes. Publicación solo en Preview.
