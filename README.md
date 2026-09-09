# Cultura y Cuchara / Vive Loja

Sitio estático preparado para GitHub y Vercel.

- `index.html`: sitio público.
- `admin.html`: panel administrativo del podcast.
- `audio/`: audios publicados con el proyecto.
- `assets/`: recursos visuales locales.
- `firebase/REGLAS-PANEL-ADMIN.md`: reglas que deben integrarse en Firebase.

El panel autorizado se abre en `/admin.html` y utiliza Firebase Authentication y
Firestore. No requiere Firebase Storage: los archivos multimedia se mantienen en el
repositorio durante la etapa de pruebas.
