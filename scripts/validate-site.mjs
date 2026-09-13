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


assert(admin.includes('function adminSubscriptionBadge'), 'La lista de paradas muestra alertas de vencimiento');
assert(admin.includes('Vence en ${Math.max(0,days)} días'), 'El panel avisa cuando faltan siete días o menos');
assert(admin.includes('id="placeSubscriptionAmount"'), 'El panel permite registrar el valor de la mensualidad');
assert(admin.includes('id="placeSubscriptionPaymentMethod"'), 'El panel permite registrar el método de pago');
assert(admin.includes('function renewPlaceSubscription'), 'El panel conserva las renovaciones rápidas');
assert(admin.includes('placePaymentHistoryDraft'), 'El historial de pagos permanece disponible');
assert(admin.includes('paymentHistory:placePaymentHistoryDraft.slice(-120)'), 'El historial se guarda con un límite seguro');
assert(admin.includes('addMonthsSafe'), 'La renovación calcula correctamente los meses');
assert(admin.includes('<option value="expired">Vencido</option>'), 'El administrador puede marcar una suscripción vencida');
assert(admin.includes('<option value="paused">Suspendido</option>'), 'El administrador puede suspender una suscripción');
assert(index.includes("'expired','suspended'"), 'La web pública bloquea beneficios vencidos o suspendidos');


assert(admin.includes('id="subscriptionCenterList"'), 'El panel conserva el centro comercial de suscripciones');
assert(admin.includes('id="subscriptionCenterFilter"'), 'El centro comercial permite filtrar por estado');
assert(admin.includes('id="subscriptionCenterIncome"'), 'El centro comercial calcula el ingreso mensual activo');
assert(admin.includes('function renderSubscriptionCenter'), 'El centro comercial puede renderizar sus clientes');
assert(admin.includes('function openSubscriptionReminder'), 'El panel prepara recordatorios por WhatsApp');
assert(admin.includes('https://wa.me/'), 'Los recordatorios abren WhatsApp para revisión manual');
assert(admin.includes('id="placeSubscriptionContactWhatsapp"'), 'Cada suscripción permite guardar su WhatsApp');
assert(admin.includes("window.prompt('Este negocio no tiene WhatsApp registrado."), 'Los negocios sin número permiten copiar el mensaje');


assert(index.includes('id="promociones"'), 'La portada conserva la sección de promociones');
assert(index.includes('id="promotionsGrid"'), 'La portada conserva la cuadrícula de promociones');
assert(index.includes('function renderPromotionsUI'), 'Las promociones vigentes pueden renderizarse');
assert(index.includes('locations.filter(placePromotionIsVisible)'), 'Solo aparecen promociones vigentes y autorizadas');
assert(index.includes("section.classList.toggle('hidden',!items.length)"), 'La sección se oculta cuando no hay promociones');
assert(index.includes('function openPromotionPlace'), 'Cada promoción abre la ficha de su negocio');
assert(admin.includes('id="placePromoTitleEn"'), 'Las promociones permiten título en inglés');
assert(admin.includes('id="placePromoDescriptionEn"'), 'Las promociones permiten mensaje en inglés');
assert(admin.includes('id="placePromoButtonTextEn"'), 'Las promociones permiten botón en inglés');


assert(admin.includes('PLACE_CATEGORY_META'), 'El panel conserva los colores de cada categoría');
assert(admin.includes('id="placesCategorySummary"'), 'La lista conserva sus accesos rápidos por categoría');
assert(admin.includes('id="placesSort"'), 'Las paradas pueden ordenarse');
assert(admin.includes('<option value="hueca">Huecas tradicionales</option>'), 'Las huecas tienen filtro propio');
assert(admin.includes('<option value="urbana">Restaurantes</option>'), 'Los restaurantes tienen filtro propio');
assert(admin.includes('<option value="cafe">Cafeterías</option>'), 'Las cafeterías tienen filtro propio');
assert(admin.includes('function setPlacesCategoryFilter'), 'Los indicadores de categoría funcionan como filtros');
assert(admin.includes('border-l-4'), 'Cada parada conserva su borde de color por categoría');


assert(index.includes('function menuDishFallbackDescription'), 'Los platos antiguos reciben una descripción de apoyo');
assert(index.includes('content-start items-start'), 'Las tarjetas usan altura natural y no comprimen el texto');
assert(!index.includes('flex flex-col h-full'), 'Las tarjetas no fuerzan su altura dentro de la cuadrícula');
assert(index.includes('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'), 'El menú mantiene columnas amplias y legibles');
assert(index.includes('break-words'), 'Los nombres largos no se recortan');
assert(admin.includes("name:'Fritada tradicional'"), 'La muestra incluye fritada tradicional');
assert(admin.includes("name:'Horchata'"), 'La muestra incluye horchata');
assert(admin.includes("name:'Quesadilla lojana'"), 'La muestra incluye quesadilla lojana');
assert(admin.includes('Se cargaron seis platos de muestra'), 'El panel confirma el menú completo de muestra');

if (failures.length) {
    console.error(`\nValidación fallida: ${failures.length} problema(s).`);
    process.exit(1);
}
console.log('\nValidación completada correctamente.');
