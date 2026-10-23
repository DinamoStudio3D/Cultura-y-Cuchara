# Cultura y Cuchara / Visita Loja

Sitio estático preparado para GitHub y Vercel.

- `index.html`: sitio público.
- `admin.html`: panel administrativo del podcast.
- `cancion-muestra-vive-loja.mp3`: canción de muestra publicada.
- `mascota-vive-loja.png`: imagen local de Chabaquito.

El panel autorizado se abre en `/admin.html` y utiliza Firebase Authentication y
Firestore. No requiere Firebase Storage: los archivos multimedia se mantienen en el
repositorio durante la etapa de pruebas.


### Estilos de las páginas públicas

La portada y las fichas de negocios cargan `css/site-utilities.css`, compilado con Tailwind 3.4.17. No se debe restaurar Play CDN en estas páginas: la presentación debe existir antes de ejecutar JavaScript y aunque un CDN externo no responda.

Después de añadir clases completas en HTML o JavaScript, ejecutar `npm install` y `npm run build:css`; incluir el CSS generado en el commit. Vercel ejecuta el mismo comando al desplegar. Si cambia el contenido del CSS, actualizar su versión en los enlaces de ambas páginas y en `LOCAL_SHELL`, además de la versión de caché de `service-worker.js`. Las clases construidas por concatenación deben declararse completas o añadirse a `safelist` en `tailwind.config.cjs`.

Comprobar `node --test scripts/test-static-public-css.mjs` y `node scripts/validate-site.mjs`. Revisar Safari/iOS real antes de afirmar compatibilidad con una versión concreta; las pruebas en Chromium no sustituyen esa revisión.
