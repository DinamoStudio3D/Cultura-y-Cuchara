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
const merchantRewards = read('merchant-rewards.html');
const loyaltyVisitor = read('fidelidad.html');
const loyaltyMerchant = read('confirmar-visitas.html');
const loyaltyAdmin = read('gestion-fidelidad.html');
const merchantDashboard = read('merchant-dashboard.html');
const manifestText = read('manifest.webmanifest');
const serviceWorker = read('service-worker.js');
const firestoreRules = read('firestore.rules');
const chabaquitoPublicV2 = read('js/chabaquito-public-v2.js');
assert(!chabaquitoPublicV2.includes('remaining=remaining') && chabaquitoPublicV2.includes('remaining=Math.max(0,target-current)'), 'Las misiones activas calculan el progreso restante sin romper el render público');
const backendFunctions = read('functions/index.js');
const chabaquitoWorker = read('workers/chabaquito/src/index.js');
const selfCheckin = read('visita.html');
const chabaquitoRuntimeConfig = read('js/chabaquito-runtime-config.js');

for (const [name, content] of [['index.html', index], ['admin.html', admin], ['merchant-rewards.html', merchantRewards], ['fidelidad.html', loyaltyVisitor], ['confirmar-visitas.html', loyaltyMerchant], ['gestion-fidelidad.html', loyaltyAdmin], ['merchant-dashboard.html', merchantDashboard], ['service-worker.js', serviceWorker], ['firestore.rules', firestoreRules]]) {
    assert(!/^(<{7}|={7}|>{7})/m.test(content), `${name} no contiene conflictos de Git sin resolver`);
}

function validateInlineScripts(name, html) {
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].filter(match => !/type\s*=\s*["']application\/ld\+json["']/i.test(match[0])).map(match => match[1]).filter(code => code.trim());
    for (const match of html.matchAll(/<script\s[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try { JSON.parse(match[1]); pass(`${name}: JSON-LD válido`); }
        catch (error) { fail(`${name}: JSON-LD inválido: ${error.message}`); }
    }
    let valid = 0;
    scripts.forEach((code, index) => {
        try { new Function(code); valid++; }
        catch (error) { fail(`${name}: error de JavaScript en el bloque ${index + 1}: ${error.message}`); }
    });
    if (valid === scripts.length) pass(`${name}: ${valid} bloques JavaScript válidos`);
}

validateInlineScripts('index.html', index);
validateInlineScripts('admin.html', admin);
validateInlineScripts('merchant-rewards.html', merchantRewards);
validateInlineScripts('fidelidad.html', loyaltyVisitor);
validateInlineScripts('confirmar-visitas.html', loyaltyMerchant);
validateInlineScripts('gestion-fidelidad.html', loyaltyAdmin);
validateInlineScripts('merchant-dashboard.html', merchantDashboard);
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
    ['rel="manifest"', 'Enlace al manifiesto'], ["serviceWorker.register('./service-worker.js?v=9'", 'Registro del modo instalable'],
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
assert(!index.includes('shadow-sm flex flex-col h-full'), 'Las tarjetas del menú no fuerzan su altura dentro de la cuadrícula');
assert(index.includes('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'), 'El menú mantiene columnas amplias y legibles');
assert(index.includes('break-words'), 'Los nombres largos no se recortan');
assert(admin.includes("name:'Fritada tradicional'"), 'La muestra incluye fritada tradicional');
assert(admin.includes("name:'Horchata'"), 'La muestra incluye horchata');
assert(admin.includes("name:'Quesadilla lojana'"), 'La muestra incluye quesadilla lojana');
assert(admin.includes('Se cargaron seis platos de muestra'), 'El panel confirma el menú completo de muestra');


assert(admin.includes('id="placeCommerceWhatsapp"'), 'El panel permite configurar el WhatsApp del negocio');
assert(admin.includes('id="placeOrderActive"'), 'El panel permite activar pedidos');
assert(admin.includes('id="placeReservationActive"'), 'El panel permite activar reservaciones');
assert(admin.includes('id="placeOrderMessageEn"'), 'Los pedidos conservan mensaje en inglés');
assert(admin.includes('id="placeReservationMessageEn"'), 'Las reservaciones conservan mensaje en inglés');
assert(index.includes('id="previewCommerceActions"'), 'La ficha conserva los botones comerciales');
assert(index.includes('id="restaurantMenuCommerceActions"'), 'El menú conserva los botones comerciales');
assert(index.includes('function openCommerceWhatsapp'), 'Los botones preparan el mensaje de WhatsApp');
assert(index.includes("replace(/\\{negocio\\}/gi,business)"), 'El mensaje incluye automáticamente el negocio');
assert(index.includes('commerce.orderActive===true&&!!phone'), 'Los pedidos se ocultan cuando no están configurados');


assert(admin.includes('function menuDishTemplate'), 'El editor conserva la plantilla completa de platos');
assert(admin.includes('function renderPlaceMenuDishes'), 'El panel puede renderizar y editar los platos');
assert(admin.includes("recommended:false"), 'Cada plato permite marcarse como recomendado');
assert(admin.includes("isNew:false"), 'Cada plato permite marcarse como nuevo');
assert(admin.includes("vegetarian:false"), 'Cada plato permite marcarse como vegetariano');
assert(admin.includes("spicy:false"), 'Cada plato permite marcarse como picante');
assert(admin.includes("available:true"), 'Cada plato conserva su disponibilidad');
assert(admin.includes("typeof value==='boolean'?value"), 'Las etiquetas se guardan como valores booleanos');
assert(index.includes('function menuDishTags'), 'La web muestra las etiquetas de los platos');
assert(index.includes("en?'Sold out':'Agotado'"), 'Los platos agotados se identifican en ambos idiomas');
assert(index.includes("items=category==='all'?menu.dishes"), 'La web respeta el orden manual de los platos');
assert(admin.includes('function movePlaceMenuDish'), 'El panel permite cambiar la posición de un plato');
assert(admin.includes("movePlaceMenuDish(${index},-1)"), 'Cada plato conserva el botón Subir');
assert(admin.includes("movePlaceMenuDish(${index},1)"), 'Cada plato conserva el botón Bajar');
assert(admin.includes('Orden del menú actualizado.'), 'El panel avisa que debe guardarse el nuevo orden');


assert(admin.includes('id="placeProfilePhone"'), 'El perfil comercial permite guardar teléfono');
assert(admin.includes('id="placeProfileWhatsapp"'), 'El perfil comercial permite guardar WhatsApp');
assert(admin.includes('id="placeProfileInstagram"'), 'El perfil comercial permite guardar redes sociales');
assert(admin.includes('id="placeProfilePriceRange"'), 'El perfil comercial permite indicar precios');
assert(admin.includes('id="placePaymentCard"'), 'El perfil comercial permite indicar métodos de pago');
assert(admin.includes('id="placeAmenityAccessible"'), 'El perfil comercial permite indicar accesibilidad');
assert(admin.includes('id="placeAmenityPets"'), 'El perfil comercial permite indicar si acepta mascotas');
assert(admin.includes('businessProfile:{phone:'), 'El perfil comercial se guarda con la parada');
assert(index.includes('id="previewBusinessProfile"'), 'La ficha pública conserva el perfil comercial');
assert(index.includes('function renderBusinessProfile'), 'La ficha puede renderizar servicios y contactos');
assert(index.includes('function safeBusinessProfileUrl'), 'Los enlaces comerciales requieren una URL segura');
assert(index.includes("container.classList.add('hidden')"), 'Los perfiles vacíos no dejan espacios visibles');


assert(admin.includes('function promoteMenuDish'), 'El panel puede crear una promoción desde un plato');
assert(admin.includes('onclick="promoteMenuDish('), 'Cada plato conserva el botón Crear promoción');
assert(admin.includes('id="placePromotionEditor"'), 'El editor de promoción puede localizarse desde el plato');
assert(admin.includes("document.getElementById('placePromoTitleEn').value"), 'La promoción copia el título en inglés');
assert(admin.includes("document.getElementById('placePromoDescriptionEn').value"), 'La promoción copia la descripción en inglés');
assert(admin.includes("document.getElementById('placeBenefitPromo').checked=true"), 'El beneficio de promoción se activa al preparar el contenido');
assert(admin.includes("document.getElementById('placePromoButtonUrl').value"), 'El panel prepara el enlace de WhatsApp cuando existe');
assert(admin.includes('Define las fechas y revisa todo antes de guardar.'), 'La promoción requiere revisión antes de guardarse');


assert(admin.includes('id="settingsPremiumVisual"'), 'El panel permite activar o desactivar la apariencia premium');
assert(admin.includes('id="settingsHeroStyle"'), 'El panel permite elegir el estilo de portada');
assert(admin.includes('id="settingsHeroHeight"'), 'El panel permite elegir la altura de portada');
assert(admin.includes('id="settingsCardStyle"'), 'El panel permite elegir el estilo de tarjetas');
assert(admin.includes('id="settingsCornerStyle"'), 'El panel permite configurar las esquinas');
assert(admin.includes('id="settingsHeroImageOpacity"'), 'El panel permite ajustar la visibilidad de fotografías');
assert(admin.includes('id="settingsPremiumAnimations"'), 'El panel permite controlar las animaciones');
assert(index.includes('body.visual-premium'), 'La web conserva los estilos premium aislados');
assert(index.includes("body?.classList.toggle('visual-premium'"), 'La apariencia premium puede revertirse');
assert(index.includes("--premium-radius"), 'Las esquinas premium se aplican mediante una variable segura');
assert(index.includes('@media (prefers-reduced-motion:reduce)'), 'La apariencia respeta el movimiento reducido');
assert(index.includes("['cinematic','classic','clean'].includes"), 'La web valida los estilos de portada permitidos');
assert(index.includes("['elevated','bordered','soft'].includes"), 'La web valida los estilos de tarjetas permitidos');


assert(admin.includes('id="storiesNavBtn"'), 'El panel conserva el acceso a Historias de Loja');
assert(admin.includes('id="storiesModule"'), 'El panel conserva el módulo completo de historias');
assert(admin.includes("doc('stories')"), 'Las historias usan siteContent autorizado por las reglas actuales');
assert(admin.includes('id="storiesSectionActive"'), 'La sección de historias puede activarse o desactivarse');
assert(admin.includes('id="storyStatus"'), 'Cada historia conserva su estado de publicación');
assert(admin.includes('id="storyPublishAt"'), 'Las historias pueden programarse');
assert(admin.includes('id="storyBodyEn"'), 'Las historias conservan contenido completo en inglés');
assert(admin.includes('id="storyAudioEn"'), 'Las historias conservan audio en inglés');
assert(admin.includes('id="storyRelatedPlaces"'), 'Las historias pueden vincular paradas');
assert(admin.includes('function moveStory'), 'Las historias pueden ordenarse manualmente');
assert(index.includes('id="historias"'), 'La web conserva la sección pública de historias');
assert(index.includes('id="storyModal"'), 'La web conserva la lectura inmersiva');
assert(index.includes('function publicStoryItems'), 'Solo se muestran historias publicadas y programadas');
assert(index.includes("story.status==='published'"), 'Los borradores no aparecen al público');
assert(index.includes('function toggleStoryNarration'), 'Las historias permiten reproducir audio');
assert(index.includes('SpeechSynthesisUtterance'), 'La voz automática permanece como respaldo');
assert(index.includes('function openStoryPlace'), 'Las historias conectan con paradas relacionadas');
assert(index.includes('function shareCurrentStory'), 'Las historias pueden compartirse');


assert(index.includes('viewport-fit=cover'), 'La web respeta las áreas seguras de móviles modernos');
assert(index.includes('Mobile UX hardening: isolated from desktop layouts'), 'La web conserva la capa responsive móvil aislada');
assert(index.includes('#restaurantMenuModal > div'), 'El menú gastronómico se adapta a pantalla completa en móvil');
assert(index.includes('height: 100dvh'), 'Los modales usan la altura dinámica del dispositivo');
assert(index.includes('#mapPreviewCard { min-height: 0'), 'La ficha del mapa evita alturas forzadas en móvil');
assert(index.includes('input, select, textarea { font-size: 16px'), 'Los formularios públicos evitan zoom involuntario en iPhone');
assert(admin.includes('Mobile admin UX hardening'), 'El panel conserva su adaptación móvil');
assert(admin.includes('viewport-fit=cover'), 'El panel respeta las áreas seguras del dispositivo');
assert(admin.includes('.admin-sidebar{position:fixed!important'), 'El menú administrativo móvil permanece navegable');

assert(!index.includes('.web-mascot-bubble { display: none !important; }'), 'Los mensajes de Chabaquito permanecen visibles en móviles pequeños');


assert(index.includes('function selectRestaurantMenuCategory'), 'Las etiquetas de platos permiten filtrar su categoría');
assert(index.includes('data-menu-category='), 'Los filtros de categorías usan valores seguros y configurables');
assert(index.includes('Restaurant menu categories: compact, complete and tappable on mobile'), 'Las categorías del menú se organizan correctamente en móvil');
assert(index.includes('restaurantMenuModal" class="fixed inset-0 z-[100]'), 'El menú permanece sobre los botones flotantes');


assert(index.includes('function syncFloatingAccountInviteVisibility'), 'La invitación de registro responde al estado de menús y diálogos');
assert(index.includes('interface-layer-hidden'), 'La invitación flotante se oculta dentro de submenús');
assert(index.includes("querySelectorAll('[role=\"dialog\"], #mobileMenu')"), 'Se vigilan tanto ventanas como el menú móvil');


assert(index.includes("rawDesc=String("), 'Las descripciones vacías activan un texto de respaldo');
assert(index.includes('menu-dish-description'), 'Cada tarjeta conserva un espacio visible para su descripción');
assert(index.includes('grid-auto-rows: max-content'), 'Las filas del menú crecen según todo su contenido');


assert(index.includes("completeChabaquitoMission('mapa')"), 'Explorar una parada completa la misión del mapa');
assert(index.includes("completeChabaquitoMission('ruta')"), 'Guardar una parada completa la misión de ruta');
assert(index.includes("completeChabaquitoMission('postal')"), 'Descargar una postal completa su misión');
assert(index.includes("completeChabaquitoMission('fiavl')"), 'Explorar FIAVL completa su misión');
assert(index.includes("activeStoryAudio.play().then(()=>{label.textContent=en?'Stop audio':'Detener audio';completeChabaquitoMission('podcast')"), 'Escuchar una historia grabada completa la misión de audio');
assert(index.includes("window.speechSynthesis?.speak(utterance);completeChabaquitoMission('podcast')"), 'La narración automática también completa la misión de audio');
assert(index.includes("currentLang==='en'?(isComplete?'Completed':'Go now')"), 'Los estados de misión se traducen al inglés');


assert(admin.includes('id="missionsActive"'), 'El panel permite mostrar u ocultar las misiones');
assert(admin.includes('id="missionsTitleEn"'), 'El panel configura el título de misiones en inglés');
assert(admin.includes('id="missionsRewardDescriptionEn"'), 'El panel configura la recompensa en ambos idiomas');
assert(admin.includes('missions:{active:document.getElementById'), 'La configuración de misiones se guarda en Firestore');
assert(index.includes('function applyMissionPresentation'), 'La web aplica la presentación configurable de misiones');
assert(index.includes("section.classList.toggle('hidden',config.active===false)"), 'El módulo público puede ocultarse sin borrar progreso');
assert(index.includes('id="chabaquitoV2Public"') && index.includes('src="js/chabaquito-public-v2.js"') && chabaquitoPublicV2.includes('mission.badge?.title'), 'Chabaquito V2 muestra la insignia configurada de cada misión');


assert(chabaquitoPublicV2.includes('chabaquitoV2Rewards') && chabaquitoPublicV2.includes("collection('chabaquitoDigitalRewards').where('userId','==',uid)") && chabaquitoPublicV2.includes('r.badge?.title'), 'Chabaquito V2 muestra las recompensas del usuario desde Firestore');
assert(index.includes('function missionRewardCampaignActive'), 'La recompensa respeta la vigencia de la campaña');
assert(index.includes("chabaquitoMissionIds.every(id=>completedChabaquitoMissions.includes(id))"), 'La recompensa requiere completar todas las misiones');
assert(index.includes('function claimMissionReward'), 'El visitante puede registrar su recompensa');
assert(index.includes('currentVisitorProfile?.profileComplete'), 'El visitante debe completar su perfil antes de reclamar');
assert(index.includes('function missionRewardClaimId'), 'Cada cuenta recibe un único registro por campaña');
assert(index.includes("db.runTransaction(async transaction=>{const campaign=await transaction.get(campaignRef)"), 'La reserva de existencias y el código se crean en una transacción');
assert(index.includes("error?.code==='reward-stock-empty'"), 'La web informa cuando se agotan las recompensas');
assert(index.includes("Últimas recompensas disponibles") && index.includes("Recompensa disponible"), 'La web pública muestra disponibilidad sin revelar cantidades');
assert(!index.includes("Quedan ${remaining} de ${stock} recompensas"), 'La web pública oculta las existencias exactas');
assert(index.includes("transaction.set(ref,data)"), 'El primer reclamo se crea dentro de la reserva atómica de existencias');
assert(index.includes("const existing=await db.collection('missionRewardClaims').doc(id).get()"), 'Un código previamente registrado puede recuperarse tras impedir su reemplazo');
assert(!index.includes("const ref=db.collection('missionRewardClaims').doc(id),existing=await ref.get()"), 'La creación no requiere permiso de lectura sobre un código inexistente');
assert(index.includes("'CHABA-'"), 'Los códigos de misión usan un formato reconocible');
assert(index.includes("db.collection('missionRewardClaims')"), 'Los códigos se guardan en su colección protegida');
assert(admin.includes('id="missionBenefitCampaignId"'), 'El panel configura campañas de recompensa');
assert(admin.includes('id="missionBenefitStart"') && admin.includes('id="missionBenefitEnd"'), 'El panel configura inicio y fin de campaña');
assert(admin.includes('id="missionBenefitStock"'), 'El panel comunica la cantidad disponible');
assert(admin.includes('stock:Math.min(10000,Math.max(1,Math.floor('), 'El panel guarda existencias enteras dentro del límite permitido');
assert(admin.includes("const campaignId=data.benefit.campaignId,claims=await missionRewardClaimsRef.where('campaignId','==',campaignId).get()"), 'El panel sincroniza las existencias reales de la campaña');
assert(admin.includes('missionRewardCampaignsRef.doc(campaignId)'), 'Cada campaña conserva su propio inventario');
assert(admin.includes('id="missionRewardClaimsList"'), 'El panel muestra ganadores y códigos');
assert(admin.includes('function updateMissionRewardClaim'), 'El administrador puede entregar o anular códigos');
assert(admin.includes('id="missionStatAvailable"') && admin.includes('id="missionStatRedemption"'), 'Chabaquito muestra existencias y porcentaje de canje');
assert(admin.includes('function updateMissionRewardStats'), 'Las estadísticas de recompensa se actualizan con la campaña seleccionada');
assert(admin.includes('missionRewardCampaignsRef.onSnapshot'), 'El panel escucha el inventario real de las campañas');
assert(admin.includes('function downloadMissionRewardsCsv'), 'El administrador puede descargar el informe de recompensas');
assert(admin.includes("const csv='\\uFEFF'"), 'El CSV incluye codificación compatible con Excel');
assert(admin.includes("join(';')"), 'El CSV usa columnas compatibles con Excel en español');
assert(admin.includes('id="missionMerchantRequestsList"'), 'Chabaquito muestra solicitudes de acceso de negocios');
assert(admin.includes('function authorizeMissionMerchant'), 'El administrador puede autorizar un negocio por campaña');
assert(admin.includes('function prepareExistingMissionRewardCodes'), 'Los códigos anteriores pueden prepararse para el verificador');
assert(merchantRewards.includes('signInWithEmailAndPassword'), 'El negocio puede ingresar con correo y contraseña');
assert(merchantRewards.includes('sendPasswordResetEmail'), 'El negocio puede recuperar su contraseña');
assert(merchantRewards.includes('signInWithPopup'), 'Google permanece como forma alternativa de ingreso');
assert(merchantRewards.includes('function verifyRewardCode'), 'El portal permite verificar un código');
assert(merchantRewards.includes('function deliverReward'), 'El portal permite confirmar una entrega');
assert(merchantRewards.includes('function loadMerchantInventory'), 'El negocio ve las existencias exactas de sus campañas');
assert(admin.includes('id="passportTouristMerchant"') && admin.includes('id="passportLocalMerchant"'), 'El pasaporte asigna un negocio por modalidad');
assert(admin.includes('function prepareExistingPassportRewardCodes'), 'Los códigos anteriores del pasaporte pueden prepararse');
assert(index.includes("db.collection('passportRewardClaimCodes').doc(claimCode)"), 'Cada premio del pasaporte crea un índice seguro');
assert(merchantRewards.includes("type='passport'"), 'El portal verifica también códigos del pasaporte');
assert(firestoreRules.includes('function hasPassportMerchantGrant'), 'Firestore limita cada negocio a la modalidad autorizada');
assert(firestoreRules.includes('match /passportRewardClaimCodes/{claimCode}'), 'Firestore protege los códigos del pasaporte');
assert(merchantRewards.includes('${remaining} de ${stock} disponibles'), 'Las cantidades exactas permanecen en el portal autorizado');
assert(firestoreRules.includes('function hasMissionMerchantCampaign'), 'Firestore limita al negocio a sus campañas autorizadas');
assert(firestoreRules.includes('match /missionRewardClaimCodes/{claimCode}'), 'Firestore protege el índice privado de códigos');
assert(firestoreRules.includes("resource.data.status == 'pending'"), 'Un negocio solo puede entregar códigos pendientes');
assert(/affectedKeys\(\)\.hasOnly\(\[\s*'status',\s*'processedAt',\s*'processedBy'/.test(firestoreRules), 'El negocio no puede modificar los datos de la recompensa');
assert(index.includes("db.collection('missionRewardClaimCodes').doc(claimCode)"), 'Cada recompensa nueva crea su índice seguro');
assert(index.includes("if(error?.code!=='permission-denied')throw error;await reserveReward(false)"), 'La publicación gradual no interrumpe la generación de recompensas');
assert(admin.includes("status!=='delivered'") && admin.includes("status!=='cancelled'"), 'El panel conserva las acciones según el estado del código');
assert(firestoreRules.includes('match /missionRewardClaims/{claimId}'), 'Firestore protege los códigos de misiones');
assert(firestoreRules.includes('match /missionRewardCampaigns/{campaignId}'), 'Firestore protege las existencias de las campañas');
assert(/affectedKeys\(\)\.hasOnly\(\[\s*'issuedCount',\s*'updatedAt'/.test(firestoreRules), 'El visitante solo puede descontar una recompensa');
assert(firestoreRules.includes('resource.data.issuedCount < resource.data.stock'), 'Firestore bloquea códigos cuando se agotan las existencias');
assert(firestoreRules.includes('existsAfter(/databases/$(database)/documents/missionRewardClaims/'), 'Firestore exige crear el código junto con el descuento');
assert(firestoreRules.includes("request.resource.data.keys().hasOnly(["), 'Firestore rechaza campos inesperados en los reclamos');
assert(firestoreRules.includes("claimId == request.auth.uid + '_' + request.resource.data.campaignId"), 'Firestore impide más de un reclamo por cuenta y campaña');
assert(firestoreRules.includes("request.resource.data.claimCode.matches('^CHABA-[A-Z0-9]{6}$')"), 'Firestore valida el formato de los códigos');
assert(firestoreRules.includes("request.resource.data.completedMissions == 5"), 'Firestore exige las cinco misiones');
assert(firestoreRules.includes('allow update, delete: if isViveLojaAdmin();'), 'Solo un administrador puede procesar o eliminar códigos');


[
    ['match /visitCodes/{requestId}', 'Códigos temporales de visita'],
    ['match /loyaltyPrograms/{placeId}', 'Programas de fidelidad'],
    ['match /loyaltyCounters/{counterId}', 'Contadores privados de fidelidad'],
    ['match /loyaltyRewardClaims/{claimId}', 'Recompensas de fidelidad'],
    ['function isAssignedVisitMerchant(placeId)', 'Autorización por establecimiento']
].forEach(([needle, label]) => assert(firestoreRules.includes(needle), `firestore.rules conserva: ${label}`));

assert(/const CACHE_NAME = 'visita-loja-shell-v[1-9]\d*';/.test(serviceWorker), 'El caché usa una versión nueva y controlada');
assert(serviceWorker.includes("const isHome = url.pathname === '/'"), 'Solo la portada puede guardarse como index.html sin conexión');
assert(loyaltyVisitor.includes("ecuadorDay()+'_'+place.id+'_'+code"), 'Los códigos temporales usan una identidad única por fecha, parada y número');
assert(loyaltyVisitor.includes("Number(saved.expires)>Date.now()"), 'El visitante reutiliza su código vigente en vez de generar duplicados');
assert(!loyaltyVisitor.includes('href="merchant-rewards.html"'), 'El visitante no es enviado al portal privado del negocio');
assert(loyaltyMerchant.includes("ecuadorDay()+'_'+placeId+'_'+value"), 'El negocio busca primero el código vigente por identidad directa');
assert(loyaltyMerchant.includes(".limit(25)"), 'La búsqueda compatible evita que pocos códigos vencidos oculten uno válido');
assert(loyaltyAdmin.includes('id="cleanupCodes"'), 'Administración permite limpiar códigos temporales vencidos');
assert(loyaltyAdmin.includes("pendingCodes.filter(item=>!ms(item.expiresAt)||ms(item.expiresAt)>Date.now()).length"), 'La estadística pendiente excluye códigos vencidos');
assert(merchantDashboard.includes('missionRewardMerchants'), 'El tablero del negocio valida la cuenta autorizada');
assert(merchantDashboard.includes('loyaltyVisits'), 'El tablero del negocio consulta visitas de fidelidad');
assert(merchantDashboard.includes('loyaltyRewardClaims'), 'El tablero del negocio consulta recompensas de fidelidad');
assert(merchantDashboard.includes('function downloadCsv') && merchantDashboard.includes("el('csv').onclick=downloadCsv"), 'El tablero del negocio conserva la exportación de datos');
assert(loyaltyMerchant.includes("fetch(CHABAQUITO_WORKER+'/merchant-confirm-visit'") && chabaquitoWorker.includes('if (previousDaily >= maxDaily) throw new Error("Daily visit limit reached")') && chabaquitoWorker.includes('dailyVisitCount: previousDaily + 1'), 'La confirmación gratuita por Worker controla el máximo diario de visitas');
assert(firestoreRules.includes('dailyVisitCount'), 'Firestore protege el contador diario de fidelidad');
assert(admin.includes('customCampaigns') && index.includes('customCampaignsPublic'), 'Las campañas personalizadas siguen conectadas entre administración y la web');
assert(admin.includes('tourismDay'), 'La campaña del Día Mundial del Turismo conserva su configuración administrativa');

// Chabaquito stable Worker: frontend must use the verified production-ready endpoint.
assert(chabaquitoWorker.includes('url.pathname === "/health"'), 'Worker conserva health check');
assert(chabaquitoWorker.includes('url.pathname === "/merchant-confirm-visit"'), 'Worker conserva confirmación de visitas');
assert(chabaquitoWorker.includes('url.pathname === "/merchant-reverse-visit"'), 'Worker conserva reversión de visitas');
assert(chabaquitoWorker.includes('url.pathname === "/ranking-preference"'), 'Worker conserva preferencias del ranking');
assert(chabaquitoWorker.includes('url.pathname === "/proximity-visit"'), 'Worker conserva validación QR por proximidad');
assert(chabaquitoWorker.includes('Fuera del radio de 15 metros'), 'Worker valida el radio seguro de 15 metros');
assert(chabaquitoWorker.includes('accuracy > 20'), 'Worker rechaza GPS con precisión peor a 20 metros');
assert(chabaquitoWorker.includes('24 * 60 * 60 * 1000'), 'Worker conserva cooldown de 24 horas para autovisitas');
assert(chabaquitoWorker.includes('const evidenceKey = `self_visit:${evidenceId}`'), 'Worker conserva la clave canónica de evidencia QR');
assert((chabaquitoWorker.match(/currentDocument: \{ exists: false \}/g)||[]).length >= 4, 'Worker protege creaciones únicas de evidencia, XP y auditoría');
assert(chabaquitoWorker.includes('currentDocument: { updateTime: profileDocument.updateTime }'), 'Worker evita actualizar XP sobre un perfil concurrentemente modificado');
assert(chabaquitoWorker.includes('async function firestoreRunQuery(accessToken, structuredQuery, transaction = null)'), 'Worker permite consultas Firestore dentro de una transacción');
assert(chabaquitoWorker.includes('}, transaction);'), 'La evidencia QR se consulta dentro de la transacción');
assert(chabaquitoWorker.includes('firestoreGetDocumentInTransaction(accessToken, evidencePath, transaction)'), 'La evidencia QR se comprueba dentro de la transacción');
assert(chabaquitoWorker.includes('firestoreGetDocumentInTransaction(accessToken, profilePath, transaction)'), 'El perfil Chabaquito se lee dentro de la transacción QR');
assert(chabaquitoWorker.includes('await firestoreCommit(accessToken, transaction, writes)'), 'La evidencia y XP QR se confirman en una sola transacción');


assert(admin.includes("visitPurpose==='self_checkin'"), 'El administrador vincula los QR permanentes de autovisita');
assert(admin.includes("const linkedQrId=unattended?String(place.discovery?.qrId||'').trim():''"), 'El administrador reutiliza el QR permanente ya vinculado');
assert(admin.includes('const selfCheckinQrId=qrId'), 'El enlace impreso usa exactamente el ID del QR que se guarda');
assert(admin.includes('batch.set(qrRef.doc(id),{...data,active:true,discoveryEnabled:true,placeId:visitPlaceId}'), 'El QR permanente se aprovisiona dentro de un batch atómico');
assert(admin.includes("batch.set(placeRef,{discovery:{enabled:true,method:'proximity',qrId:id}"), 'La asociación QR-parada se guarda en el mismo batch');

assert(admin.includes("discovery:{enabled:true,method:'proximity',qrId:id}"), 'El administrador activa proximidad al guardar un QR sin encargado');
assert(admin.includes("active:true,discoveryEnabled:true,placeId:visitPlaceId"), 'El QR sin encargado queda activo y asociado a una sola parada');
assert(admin.includes('No se puede generar el QR sin encargado: esta parada no tiene coordenadas válidas.'), 'El administrador bloquea QR sin coordenadas válidas');
assert(admin.includes('No se puede generar el QR sin encargado: selecciona primero el cantón'), 'El administrador bloquea QR sin cantón');
assert(admin.includes('No se puede generar el QR sin encargado: publica primero la parada'), 'El administrador bloquea QR de paradas no publicadas');
assert(chabaquitoWorker.includes('String(place.discovery?.qrId || "") !== qrId'), 'El Worker exige que el QR pertenezca a la parada validada');
assert(chabaquitoWorker.includes('Parada no publicada o inactiva'), 'El Worker rechaza QR de paradas inactivas o no publicadas');
assert(chabaquitoWorker.includes('canonicalCantons'), 'El Worker exige un cantonId canónico de Loja');
assert(chabaquitoWorker.includes('Parada sin cantonId válido'), 'El Worker bloquea autovisitas sin cantón válido');
assert(chabaquitoWorker.includes('const eventId = `discovery:canton:${cantonId}`'), 'El XP de cantón usa el cantonId canónico normalizado');
assert(chabaquitoWorker.includes('targetId: cantonId, xp: 50, placeId: null, cantonId'), 'El evento FIRST_CANTON conserva el cantonId normalizado');


assert(selfCheckin.includes("discoveryMethod==='proximity'||discoveryMethod==='both'||place.validationMode==='self_checkin'"), 'La página de visita acepta los modos canónicos proximity/both');
assert(selfCheckin.includes("!place.discovery?.enabled||!proximityEnabled"), 'La página de visita exige discovery habilitado');
assert(chabaquitoRuntimeConfig.includes("workerUrl:'https://visitaloja-chabaquito.sukogames1996.workers.dev'"), 'La configuración central usa el Worker estable de Chabaquito');
assert(selfCheckin.includes('js/chabaquito-runtime-config.js') && selfCheckin.includes('VisitaLojaChabaquitoConfig?.workerUrl'), 'La autovisita obtiene el Worker desde la configuración central');
assert(loyaltyMerchant.includes('js/chabaquito-runtime-config.js') && loyaltyMerchant.includes('VisitaLojaChabaquitoConfig?.workerUrl'), 'La confirmación con encargado obtiene el Worker desde la configuración central');
assert(chabaquitoPublicV2.includes('VisitaLojaChabaquitoConfig?.workerUrl'), 'El ranking Chabaquito obtiene el Worker desde la configuración central');
assert(selfCheckin.includes('fetch(CHABAQUITO_WORKER+"/proximity-visit"'), 'La autovisita envía la validación GPS al endpoint de proximidad');
assert(selfCheckin.includes('MAX_ACCURACY_M=20') && selfCheckin.includes('SAMPLE_MS=12000'), 'La autovisita conserva precisión GPS máxima y muestreo controlado');
assert(selfCheckin.includes('xpDelta') && selfCheckin.includes('validatedXp'), 'La celebración usa XP devuelto por el backend');
assert(selfCheckin.includes('newlyCompletedMissionIds'), 'La celebración detecta nuevas misiones completadas');
assert(selfCheckin.includes('id="celebrationBox"'), 'La página conserva la tarjeta de celebración de Chabaquito');
assert(selfCheckin.includes("title='Esta visita ya fue registrada'") && selfCheckin.includes('después de 24 horas'), 'La autovisita explica claramente el cooldown de 24 horas');
assert(selfCheckin.includes("title='Acércate un poco más a la parada'") && selfCheckin.includes('15 metros'), 'La autovisita explica claramente el radio físico de 15 metros');
assert(selfCheckin.includes('href="./#chabaquitoV2Public"'), 'La celebración enlaza con misiones e insignias');
assert(chabaquitoPublicV2.includes('function levelProgress(xp)'), 'El perfil Chabaquito calcula el progreso hacia el siguiente nivel');
assert(chabaquitoPublicV2.includes("text('Insignia desbloqueada','Badge unlocked')"), 'Las misiones completadas muestran la insignia desbloqueada');
assert(chabaquitoPublicV2.includes("text('Te faltan '+remaining+' para completar esta misión.'"), 'Las misiones activas muestran cuánto falta para completarlas');
assert(chabaquitoPublicV2.includes("text('Guarda tu aventura con Chabaquito','Save your Chabaquito adventure')"), 'Chabaquito explica por qué iniciar sesión');
assert(chabaquitoPublicV2.includes("text('Top 10 de viajeros que decidieron participar públicamente.'"), 'El ranking explica que la participación es voluntaria');
assert(chabaquitoPublicV2.includes("text('Solo alias público','Public alias only')"), 'El ranking aclara que usa alias público');
assert(chabaquitoPublicV2.includes("🥇") && chabaquitoPublicV2.includes("🥈") && chabaquitoPublicV2.includes("🥉"), 'El ranking distingue visualmente el podio');
assert(chabaquitoPublicV2.includes("Todavía no has desbloqueado insignias"), 'La colección de insignias muestra un estado vacío útil');
assert(chabaquitoPublicV2.includes('lp.remaining') && chabaquitoPublicV2.includes('lp.pct'), 'El perfil muestra XP restante y porcentaje de nivel');




for (const route of ['/auth-test', '/firebase-test', '/firestore-test', '/mission-inspect', '/merchant-confirm-inspect']) {
    assert(!chabaquitoWorker.includes(route), `Worker no expone diagnóstico temporal: ${route}`);
}
assert(chabaquitoWorker.includes('updateMask: { fieldPaths: Object.keys(codeFields) }'), 'Worker actualiza códigos sin reescribir campos ajenos');
assert(chabaquitoWorker.includes('updateMask: { fieldPaths: Object.keys(profileFields) }'), 'Worker actualiza perfil de ranking sin reescribir campos ajenos');
assert(chabaquitoWorker.includes('qualifyingVisitIds'), 'Worker persiste las visitas que califican para misiones');
assert(chabaquitoWorker.includes('newlyCompleted: completed && !existing?.completed'), 'Worker detecta la misión que acaba de completarse');
assert(chabaquitoWorker.includes('missions.filter(item => item.newlyCompleted).map(item => item.missionId)'), 'La visita QR devuelve las nuevas misiones completadas');

assert(chabaquitoWorker.includes('chabaquitoDigitalRewards'), 'Worker sincroniza recompensas digitales de misiones');
assert(chabaquitoWorker.includes('"total_visits", "unique_places", "place_visits", "category_visits", "canton_visits"'), 'Worker admite los cinco tipos de misión V2');
assert(chabaquitoWorker.includes('mission.type === "unique_places"') && chabaquitoWorker.includes('missionText(visit.placeId)'), 'Misiones de lugares diferentes usan placeId y deduplican paradas');
assert(chabaquitoWorker.includes('collectionId: "evidence", allDescendants: true'), 'Worker incorpora evidencia confiable de Chabaquito a las misiones');
assert(chabaquitoWorker.includes('source: "chabaquito_evidence"'), 'Worker prioriza evidencia turística de Chabaquito');
assert(chabaquitoWorker.includes('item.status === "validated" || item.status === "reversed"'), 'Worker contempla evidencia validada y revertida');
assert(chabaquitoWorker.includes('new Set(missionList(mission.placeIds))'), 'Misiones por lugares respetan la lista explícita de paradas');
assert(chabaquitoWorker.includes('new Set(missionList(mission.categoryIds)'), 'Misiones por categoría respetan su alcance configurado');
assert(chabaquitoWorker.includes('new Set(missionList(mission.cantonIds)'), 'Misiones por cantón respetan su alcance configurado');
assert(chabaquitoWorker.includes('const canton = missionText(place.cantonId).toLocaleLowerCase("es")'), 'Misiones por cantón usan únicamente el cantonId canónico');
assert(!chabaquitoWorker.includes('place.cantonId || place.canton || place.city || place.ciudad || place.municipality'), 'Worker no mezcla nombres legacy con cantonId en misiones');

const chabaquitoMissionDrafts = read('js/chabaquito-mission-drafts.js');
const chabaquitoMissionModel = read('js/chabaquito-missions-v2-model.js');
const chabaquitoMissionAdmin = read('js/admin-chabaquito-missions-v2.js');
assert(chabaquitoMissionModel.includes("'unique_places'"), 'El contrato de Misiones V2 admite lugares diferentes');
assert(admin.includes('js/chabaquito-mission-drafts.js'), 'El administrador carga el catálogo inicial de misiones');
assert(admin.includes('chabaquitoV2MissionDraftSelect') && admin.includes('chabaquitoV2MissionLoadDraft'), 'El administrador expone el selector de plantillas de misión');
assert(admin.includes('function hydrateChabaquitoMissionDraftSelect()') && admin.includes('VisitaLojaChabaquitoMissionDrafts') && admin.includes('hydrateChabaquitoMissionDraftSelect();'), 'El shell del administrador hidrata las plantillas sin depender del orden de carga del módulo');
assert(admin.includes("button.onclick=()=>{") && admin.includes("set('chabaquitoV2MissionTitle',m.title)") && admin.includes("set('chabaquitoV2BadgeTitle',m.badge?.title||'')"), 'El botón Cargar plantilla rellena misión e insignia desde el shell del administrador');
assert(admin.includes("set('chabaquitoV2MissionStatus',m.status||'draft')"), 'El cargador respeta el estado definido por cada plantilla');
assert(admin.includes('chabaquitoV2MissionPublish') && admin.includes('chabaquitoV2MissionArchive') && admin.includes("status.value='active'") && admin.includes("status.value='archived'"), 'El administrador permite publicar y desactivar misiones explícitamente');
assert(admin.includes('Misiones existentes') && admin.includes('chabaquitoV2MissionCount') && admin.includes('chabaquitoV2MissionList'), 'El administrador muestra una sección visible de misiones existentes');
assert(admin.includes('loadExistingChabaquitoMissions') && admin.includes("db.collection('chabaquitoMissions').onSnapshot") && admin.includes('data-static-mission-edit'), 'El administrador tiene un cargador de respaldo para listar y editar misiones existentes');
assert(chabaquitoMissionAdmin.includes('subscribeMissions(api)') && chabaquitoMissionAdmin.includes('missionsUnsubscribe'), 'La lista de misiones se reconecta cuando Firebase ya está disponible');
assert(chabaquitoMissionAdmin.includes("$('chabaquitoV2MissionStatus').value=m.status||'draft'"), 'El módulo de misiones respeta el estado de la plantilla');
assert(chabaquitoMissionDrafts.includes("id: 'primer-paso-chabaquito'") && chabaquitoMissionDrafts.includes("id: 'explorador-lojano'") && chabaquitoMissionDrafts.includes("id: 'ruta-de-cinco'") && chabaquitoMissionDrafts.includes("id: 'descubriendo-provincia'") && chabaquitoMissionDrafts.includes("id: 'dieciseis-cantones'"), 'El catálogo conserva las cinco misiones iniciales');
assert((chabaquitoMissionDrafts.match(/status: 'active'/g)||[]).length === 4 && (chabaquitoMissionDrafts.match(/status: 'draft'/g)||[]).length === 1, 'Las cuatro misiones iniciales están activas y el reto de 16 cantones permanece en borrador');
assert(chabaquitoMissionAdmin.includes('initDrafts()'), 'El módulo inicializa las plantillas en el editor');
assert(chabaquitoMissionAdmin.includes("if(!host)return;initDrafts();const api=window.visitaLojaChabaquitoMissionsV2;") && chabaquitoMissionAdmin.includes("if(host.dataset.ready){if(!missionsUnsubscribe&&typeof db!=='undefined')subscribeMissions(api);return;}"), 'El editor reintenta la conexión de misiones cuando Firebase ya está disponible');
assert(chabaquitoMissionAdmin.includes("new Map(scopeRaw.map(value=>[value.toLocaleLowerCase('es'),value]))"), 'El administrador elimina alcances duplicados de las misiones');
assert(chabaquitoMissionAdmin.includes("type==='place_visits'&&m.targetCount>scope.length"), 'La meta por lugares no supera los lugares únicos configurados');
assert(chabaquitoMissionAdmin.includes("type==='canton_visits'&&m.targetCount>scope.length"), 'La meta por cantones no supera los cantones únicos configurados');
assert(admin.includes("const scopeRaw=val('chabaquitoV2MissionScope')") && admin.includes("new Map(scopeRaw.map(value=>[value.toLocaleLowerCase('es'),value]))"), 'El formulario estático elimina alcances duplicados');
assert(admin.includes("type==='place_visits'&&mission.targetCount>scope.length"), 'El formulario estático limita la meta de lugares específicos');
assert(admin.includes("type==='canton_visits'&&mission.targetCount>scope.length"), 'El formulario estático limita la meta de cantones');
assert(admin.includes("type!=='total_visits'&&type!=='unique_places'&&!scope.length"), 'El formulario estático exige alcance solo cuando corresponde');


assert(chabaquitoWorker.includes('visitaloja-git-integration-chabaquito-mis-433c03-dinamostudio3d.vercel.app'), 'Worker usa el origen estable de Preview');
assert(chabaquitoWorker.includes('"https://www.visitaloja.com"') && chabaquitoWorker.includes('"https://visitaloja.com"'), 'Worker autoriza ambos orígenes oficiales de VisitaLoja');

assert(index.includes('js/chabaquito-runtime-config.js'), 'La portada carga la configuración central de Chabaquito');
assert(index.indexOf('js/chabaquito-runtime-config.js') < index.indexOf('js/chabaquito-public-v2.js'), 'La configuración central de Chabaquito carga antes del módulo público');

assert(chabaquitoRuntimeConfig.includes('workers.dev'), 'La configuración central usa el Worker gratuito durante integración');

if (failures.length) {
    console.error(`\nValidación fallida: ${failures.length} problema(s).`);
    process.exit(1);
}
console.log('\nValidación completada correctamente.');
