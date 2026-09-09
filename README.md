# Cultura y Cuchara / Vive Loja

Sitio estático preparado para GitHub y Vercel.

- `index.html`: sitio público.
- `admin.html`: panel administrativo del podcast.
- `cancion-muestra-vive-loja.mp3`: canción de muestra publicada.
- `mascota-vive-loja.png`: imagen local de Chabaquito.

El panel autorizado se abre en `/admin.html` y utiliza Firebase Authentication y
Firestore. No requiere Firebase Storage: los archivos multimedia se mantienen en el
repositorio durante la etapa de pruebas.
