import fs from 'node:fs';

const failures = [];
const pass = message => console.log(`✓ ${message}`);
const fail = message => { failures.push(message); console.error(`✗ ${message}`); };
const read = path => {
    if (!fs.existsSync(path)) { fail(`Falta el archivo obligatorio: ${path}`); return ''; }
    return fs.readFileSync(path, 'utf8');
};
const assert = (condition, message) => condition ? pass(message) : fail(message);

const index = read('index.html');
const admin = read('admin.html');
const manifestText = read('manifest.webmanifest');
const serviceWorker = read('service-worker.js');

for (const [name, content] of [['index.html', index], ['admin.html', admin], ['service-worker.js', serviceWorker]]) {
    assert(!/^(<{7}|={7}|>{7})/m.test(content), `${name} no contiene conflictos de Git sin resolver`);
}

function validateInlineScripts(name, html) {
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(code => code.trim());
    let valid = 0;
    scripts.forEach((code, index) => {
        try { new Function(code); valid++; }
        catch (error) { fail(`${name}: error de JavaScript en el bloque ${index + 1}: ${error.message}`); }
    });
    if (valid === scripts.length) pass(`${name}: ${valid} bloques JavaScript válidos`);
}

validateInlineScripts('index.html', index);
validateInlineScripts('admin.html', admin);
try { new Function(serviceWorker); pass('service-worker.js tiene JavaScript válido'); }
catch (error) { fail(`service-worker.js contiene JavaScript inválido: ${error.message}`); }

let manifest = null;
try { manifest = JSON.parse(manifestText); pass('manifest.webmanifest contiene JSON válido'); }
catch (error) { fail(`manifest.webmanifest no es JSON válido: ${error.message}`); }
if (manifest) {
    assert(Boolean(manifest.name && manifest.short_name), 'El manifiesto conserva el nombre de la aplicación');
    assert(manifest.display === 'standalone', 'La aplicación se abre en modo independiente');
    assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'El manifiesto conserva al menos un icono');
}

[
    ['id="inicio"', 'Inicio público'], ['id="mapa"', 'Mapa público'],
    ['id="establecimientos"', 'Listado de paradas'], ['id="pasaporte"', 'Pasaporte'],
    ['rel="manifest"', 'Enlace al manifiesto'], ["serviceWorker.register('./service-worker.js')", 'Registro del modo instalable'],
    ['id="installAppBtn"', 'Botón de instalación']
].forEach(([needle, label]) => assert(index.includes(needle), `index.html conserva: ${label}`));

[
    ['id="loginView"', 'Inicio de sesión'], ['id="adminView"', 'Vista administrativa'],
    ['id="controlModule"', 'Centro de revisión'], ['id="adminGlobalSearchModal"', 'Buscador general'],
    ['id="adminSaveGuard"', 'Protección de cambios sin guardar'], ['id="assetCheckBtn"', 'Comprobación real de archivos']
].forEach(([needle, label]) => assert(admin.includes(needle), `admin.html conserva: ${label}`));

const dependencyOrder = [
    'leaflet@1.9.4/dist/leaflet.js', 'confetti.browser.min.js', 'firebase-app-compat.js',
    'firebase-auth-compat.js', 'firebase-firestore-compat.js', 'const translations = {'
].map(needle => index.indexOf(needle));
assert(dependencyOrder.every(position => position >= 0), 'Todas las dependencias públicas están presentes');
assert(dependencyOrder.every((position, i) => i === 0 || position > dependencyOrder[i - 1]), 'Firebase y las bibliotecas cargan en el orden seguro');
assert(serviceWorker.includes("request.mode === 'navigate'"), 'El modo sin conexión reconoce las navegaciones');
assert(serviceWorker.indexOf('fetch(request)') < serviceWorker.indexOf("caches.match('./index.html')"), 'La aplicación solicita primero la versión nueva por internet');
assert(serviceWorker.includes('url.origin !== self.location.origin'), 'El caché se limita a archivos del mismo sitio');
assert(index.includes('function isPublicContent'), 'La web pública conserva el filtro de publicación');
assert(index.includes("item.publicationStatus === 'published'"), 'Solo el contenido publicado puede mostrarse al público');
assert(admin.includes('id="placePublicationStatus"'), 'El panel permite definir el estado de cada parada');
assert(admin.includes('id="generalEventPublicationStatus"'), 'El panel permite definir el estado de cada evento');
assert(admin.includes('id="placesPublicationFilter"'), 'El panel permite filtrar paradas por estado');
assert(admin.includes('id="eventPreviewModal"'), 'El panel conserva la vista previa de eventos');
assert(admin.includes('function renderEventPreview'), 'La vista previa de eventos puede renderizarse');
assert(admin.includes('id="eventPreviewLanguage"'), 'La vista previa permite alternar español e inglés');
assert(index.includes('id="galleryMainImage"'), 'La galería conserva su imagen inmersiva principal');
assert(index.includes('function renderImmersiveGallery'), 'La galería puede navegar entre fotografías');
assert(index.includes("event.key==='ArrowLeft'"), 'La galería conserva la navegación por teclado');
assert(index.includes("addEventListener('touchstart'"), 'La galería conserva los gestos táctiles');
assert(index.includes('function shareGalleryImage'), 'La galería permite compartir fotografías');
assert(index.includes('id="previewRestaurantMenuBtn"'), 'La ficha pública conserva el botón de menú');
assert(index.includes('function restaurantMenuFor'), 'La web controla el acceso al menú por suscripción');
assert(index.includes('id="restaurantMenuGrid"'), 'La web conserva la cuadrícula visual de platos');
assert(index.includes('descriptionEn'), 'Los platos conservan su descripción en inglés');
assert(index.includes("paidPlaceBenefits(loc).menu===true"), 'Los menús configurados requieren el beneficio activo');
assert(admin.includes('id="placeBenefitMenu"'), 'El panel conserva el beneficio Menú visual');
assert(admin.includes('id="placeMenuDishesEditor"'), 'El panel conserva el editor de platos');
assert(admin.includes('function addPlaceMenuDish'), 'El panel permite agregar platos');
assert(admin.includes("'descriptionEn'"), 'El editor conserva los campos bilingües');
assert(admin.includes('function loadMamaLolaMenuSample'), 'El panel conserva la muestra de Mama Lola');
assert(admin.includes('PLAN_SERVICE_CATALOG'), 'El panel conserva el catálogo de servicios');
assert(admin.includes('data-plan-feature'), 'Cada plan permite configurar sus servicios');
assert(admin.includes('id="subscriptionsApplyToPlaces"'), 'La sincronización masiva permanece opcional');
assert(admin.includes('function applyPlanServicesToCurrentPlaces'), 'El panel puede aplicar servicios a negocios existentes');
assert(admin.includes("key:'menu'"), 'El menú visual permanece dentro del catálogo comercial');

if (failures.length) {
    console.error(`\nValidación fallida: ${failures.length} problema(s).`);
    process.exit(1);
}
console.log('\nValidación completada correctamente.');
