/* Visita Loja — módulo Mi Ruta. */

const ITINERARY_VISIT_RADIUS_METERS = 20;
const ITINERARY_MAX_ACCURACY_METERS = 35;
let activeItineraryIndex = Math.max(0, Number.parseInt(localStorage.getItem('cyc_active_itinerary_index') || '0', 10) || 0);
let itineraryJourneyActive = localStorage.getItem('cyc_itinerary_journey_active') === '1';
let itineraryCompletedStops = (() => { try { return new Set(JSON.parse(localStorage.getItem('cyc_itinerary_completed_stops') || '[]').map(String)); } catch (_) { return new Set(); } })();
let itineraryGeoWatchId = null;
let itineraryGeoState = { status: 'idle', distance: null, accuracy: null, inside: false };

function itineraryIsEnglish() { return typeof currentLang !== 'undefined' && currentLang === 'en'; }
function itineraryText(es, en) { return itineraryIsEnglish() ? en : es; }

function saveItineraryJourneyState() {
    localStorage.setItem('cyc_active_itinerary_index', String(activeItineraryIndex));
    localStorage.setItem('cyc_itinerary_journey_active', itineraryJourneyActive ? '1' : '0');
    localStorage.setItem('cyc_itinerary_completed_stops', JSON.stringify([...itineraryCompletedStops]));
}

function itineraryCurrentLocation() {
    return locations.find(l => String(l.id) === String(favoriteLocations[activeItineraryIndex]));
}

function itineraryDistanceMeters(lat1, lng1, lat2, lng2) {
    const r = 6371000, toRad = value => value * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function stopItineraryGeolocation() {
    if (itineraryGeoWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(itineraryGeoWatchId);
    itineraryGeoWatchId = null;
}

function startItineraryGeolocation() {
    stopItineraryGeolocation();
    itineraryGeoState = { status: 'checking', distance: null, accuracy: null, inside: false };
    if (!navigator.geolocation) {
        itineraryGeoState.status = 'unsupported'; updateItineraryUI(); return;
    }
    itineraryGeoWatchId = navigator.geolocation.watchPosition(position => {
        const loc = itineraryCurrentLocation();
        const lat = Number(loc?.lat), lng = Number(loc?.lng), accuracy = Number(position.coords.accuracy);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            itineraryGeoState = { status: 'no-coordinates', distance: null, accuracy, inside: false }; updateItineraryUI(); return;
        }
        const distance = itineraryDistanceMeters(position.coords.latitude, position.coords.longitude, lat, lng);
        const accurateEnough = Number.isFinite(accuracy) && accuracy <= ITINERARY_MAX_ACCURACY_METERS;
        itineraryGeoState = { status: accurateEnough ? 'ready' : 'low-accuracy', distance, accuracy, inside: accurateEnough && distance <= ITINERARY_VISIT_RADIUS_METERS };
        updateItineraryUI();
    }, error => {
        itineraryGeoState = { status: error.code === 1 ? 'denied' : 'error', distance: null, accuracy: null, inside: false };
        updateItineraryUI();
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
}

function itineraryGeoMarkup() {
    const s = itineraryGeoState;
    let message = itineraryText('Comprobando tu ubicación…','Checking your location…');
    let icon = 'fa-location-crosshairs';
    if (s.status === 'ready' && Number.isFinite(s.distance)) message = s.inside ? itineraryText(`Estás dentro del radio de ${ITINERARY_VISIT_RADIUS_METERS} m. Ya puedes completar esta visita.`,`You are within the ${ITINERARY_VISIT_RADIUS_METERS} m radius. You can complete this visit.`) : itineraryText(`Estás aproximadamente a ${Math.round(s.distance)} m de esta parada. Acércate a ${ITINERARY_VISIT_RADIUS_METERS} m para completarla.`,`You are approximately ${Math.round(s.distance)} m from this stop. Get within ${ITINERARY_VISIT_RADIUS_METERS} m to complete it.`);
    else if (s.status === 'low-accuracy') message = itineraryText(`Tu GPS tiene una precisión aproximada de ±${Math.round(s.accuracy || 0)} m. Esperando una señal más precisa…`,`Your GPS accuracy is approximately ±${Math.round(s.accuracy || 0)} m. Waiting for a more accurate signal…`);
    else if (s.status === 'denied') { message = itineraryText('La ubicación está bloqueada. Actívala en el navegador para validar la visita.','Location access is blocked. Enable it in your browser to validate the visit.'); icon = 'fa-location-dot'; }
    else if (s.status === 'unsupported') message = itineraryText('Este navegador no permite validar la visita mediante ubicación.','This browser cannot validate the visit using location.');
    else if (s.status === 'no-coordinates') message = itineraryText('Esta parada no tiene coordenadas válidas para verificar la visita.','This stop has no valid coordinates for visit verification.');
    else if (s.status === 'error') message = itineraryText('No pudimos obtener tu ubicación. Puedes volver a intentarlo.','We could not get your location. You can try again.');
    return `<div class="rounded-2xl ${s.inside ? 'bg-emerald-50 border-emerald-200' : 'bg-sky-50 border-sky-100'} border p-4"><div class="flex gap-3"><span class="w-10 h-10 rounded-full ${s.inside ? 'bg-emerald-600' : 'bg-sky-600'} text-white grid place-items-center flex-shrink-0"><i class="fa-solid ${s.inside ? 'fa-check' : icon}"></i></span><div class="min-w-0"><p class="font-black text-sm text-brandDark">${s.inside ? itineraryText('Ubicación verificada','Location verified') : itineraryText('Validación de visita','Visit verification')}</p><p class="text-xs text-gray-600 mt-1 leading-relaxed">${message}</p></div></div></div>`;
}

function completeVerifiedItineraryStop() {
    const loc = itineraryCurrentLocation();
    if (!loc || !itineraryGeoState.inside) { showToast(itineraryText(`Debes estar a ${ITINERARY_VISIT_RADIUS_METERS} m o menos de la parada para marcarla como visitada.`,`You must be within ${ITINERARY_VISIT_RADIUS_METERS} m of the stop to mark it as visited.`)); return; }
    itineraryCompletedStops.add(String(loc.id));
    saveItineraryJourneyState();
    if (activeItineraryIndex >= favoriteLocations.length - 1) {
        itineraryJourneyActive = false; stopItineraryGeolocation(); saveItineraryJourneyState(); updateItineraryUI();
        showToast(itineraryText('¡Ruta completada! Todas las visitas fueron verificadas.','Route completed! All visits were verified.')); return;
    }
    activeItineraryIndex += 1;
    itineraryGeoState = { status: 'checking', distance: null, accuracy: null, inside: false };
    saveItineraryJourneyState(); updateItineraryUI(); startItineraryGeolocation();
    showToast(itineraryText('Visita completada. Vamos a la siguiente parada.','Visit completed. Moving to the next stop.'));
}

function moveItineraryStop(id, direction) {
    const index = favoriteLocations.indexOf(String(id));
    if (index < 0) return;
    const target = index + Number(direction);
    if (target < 0 || target >= favoriteLocations.length) return;
    [favoriteLocations[index], favoriteLocations[target]] = [favoriteLocations[target], favoriteLocations[index]];
    if (itineraryJourneyActive) { if (activeItineraryIndex === index) activeItineraryIndex = target; else if (activeItineraryIndex === target) activeItineraryIndex = index; }
    persistFavorites(); saveItineraryJourneyState(); updateItineraryUI();
}

function itineraryDirectionsUrl(loc) {
    const lat = Number(loc?.lat), lng = Number(loc?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc?.address || loc?.title || 'Loja, Ecuador')}`;
}

function itineraryFullRouteUrl() {
    const stops = favoriteLocations.map(id => locations.find(l => String(l.id) === String(id))).filter(Boolean);
    if (!stops.length) return '';
    const point = loc => Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng)) ? `${Number(loc.lat)},${Number(loc.lng)}` : (loc.address || loc.title || 'Loja, Ecuador');
    if (stops.length === 1) return itineraryDirectionsUrl(stops[0]);
    const origin = point(stops[0]), destination = point(stops[stops.length - 1]);
    const waypoints = stops.slice(1, -1).map(point).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}`;
}

function openFullItineraryRoute() { const url = itineraryFullRouteUrl(); if (url) window.open(url, '_blank', 'noopener,noreferrer'); }

function startItineraryJourney() {
    if (!favoriteLocations.length) { showToast(itineraryText('Agrega al menos una parada a Mi Ruta.','Add at least one stop to My Route.')); return; }
    activeItineraryIndex = Math.min(activeItineraryIndex, favoriteLocations.length - 1); itineraryJourneyActive = true; itineraryCompletedStops.clear();
    saveItineraryJourneyState(); updateItineraryUI(); startItineraryGeolocation();
    showToast(itineraryText('Recorrido iniciado. Activando validación de ubicación.','Route started. Enabling location verification.'));
}

function goToItineraryStop(index) {
    if (!favoriteLocations.length) return;
    activeItineraryIndex = Math.max(0, Math.min(Number(index) || 0, favoriteLocations.length - 1)); itineraryJourneyActive = true;
    saveItineraryJourneyState(); updateItineraryUI(); startItineraryGeolocation();
    const loc = itineraryCurrentLocation(); if (loc) window.open(itineraryDirectionsUrl(loc), '_blank', 'noopener,noreferrer');
}

function updateItineraryUI() {
    renderVisitorExperience();
    const container = document.getElementById('itineraryListContainer'), badge = document.getElementById('itineraryBadge'), startButton = document.getElementById('startItineraryButton');
    if (!container) return; container.innerHTML = '';
    if (!favoriteLocations.length) { itineraryJourneyActive = false; activeItineraryIndex = 0; itineraryCompletedStops.clear(); stopItineraryGeolocation(); saveItineraryJourneyState(); container.innerHTML = `<div class="text-center py-12 text-gray-400 text-xs"><i class="fa-solid fa-route text-4xl mb-3 text-gray-300"></i><br><strong class="text-brandDark text-sm block mb-1">${itineraryText('Tu ruta está vacía','Your route is empty')}</strong>${itineraryText('Agrega lugares o carga una Ruta Oficial para comenzar.','Add places or load an Official Route to get started.')}</div>`; if (badge) badge.classList.add('hidden'); if (startButton) startButton.classList.add('hidden'); return; }
    activeItineraryIndex = Math.min(activeItineraryIndex, favoriteLocations.length - 1);
    if (badge) { badge.innerText = favoriteLocations.length; badge.classList.remove('hidden'); }
    if (startButton) { startButton.classList.remove('hidden'); startButton.innerHTML = itineraryJourneyActive ? `<i class="fa-solid fa-location-arrow"></i><span>${itineraryText('Continuar recorrido','Continue route')}</span>` : `<i class="fa-solid fa-route"></i><span>${itineraryText('Iniciar recorrido','Start route')}</span>`; }

    if (itineraryJourneyActive) {
        const current = itineraryCurrentLocation();
        if (current) {
            const title = itineraryIsEnglish() ? (current.titleEn || current.title) : current.title, address = itineraryIsEnglish() ? (current.addressEn || current.address || '') : (current.address || '');
            const image = current.gallery?.[0]?.img || '';
            container.innerHTML += `<section class="rounded-3xl overflow-hidden bg-brandDark text-white border border-brandGold/40 shadow-lg">${image ? `<img src="${image}" alt="" class="w-full h-40 sm:h-52 object-cover" loading="lazy">` : ''}<div class="p-4 sm:p-6"><div class="flex items-start justify-between gap-4"><div><p class="text-[10px] sm:text-xs uppercase tracking-[.18em] text-brandGold font-black">${itineraryText('Modo recorrido','Route mode')} · ${activeItineraryIndex + 1}/${favoriteLocations.length}</p><h3 class="font-black text-xl sm:text-2xl mt-1">${escapeHTML(title)}</h3><p class="text-xs sm:text-sm text-gray-300 mt-2">${escapeHTML(address)}</p></div><span class="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-brandGold text-white grid place-items-center text-lg font-black flex-shrink-0">${activeItineraryIndex + 1}</span></div><div class="mt-5">${itineraryGeoMarkup()}</div><div class="grid sm:grid-cols-3 gap-2 mt-4"><button type="button" onclick="goToItineraryStop(${activeItineraryIndex})" class="min-h-12 bg-brandGold text-white rounded-xl px-4 py-3 text-sm font-black"><i class="fa-solid fa-diamond-turn-right mr-2"></i>${itineraryText('Cómo llegar','Directions')}</button><button type="button" onclick="openFullItineraryRoute()" class="min-h-12 bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-sm font-black"><i class="fa-solid fa-map-location-dot mr-2"></i>${itineraryText('Ruta completa','Full route')}</button><button type="button" onclick="completeVerifiedItineraryStop()" ${itineraryGeoState.inside ? '' : 'disabled'} class="min-h-12 rounded-xl px-4 py-3 text-sm font-black ${itineraryGeoState.inside ? 'bg-emerald-600 text-white' : 'bg-white/10 text-gray-400 cursor-not-allowed'}"><i class="fa-solid fa-location-check mr-2"></i>${itineraryText('Marcar visitada','Mark visited')}</button></div></div></section>`;
        }
    } else container.innerHTML += `<div class="rounded-xl bg-orange-50 border border-orange-100 p-3 text-xs text-orange-900"><i class="fa-solid fa-hand-pointer text-brandGold mr-2"></i><strong>${itineraryText('Ordena tus paradas','Organize your stops')}</strong> ${itineraryText('y luego pulsa','then tap')} <strong>${itineraryText('Iniciar recorrido','Start route')}</strong>.</div>`;

    const routeNames = favoriteLocations.map((id, idx) => { const loc = locations.find(l => String(l.id) === String(id)); if (!loc) return ''; const done = itineraryCompletedStops.has(String(id)); const name = itineraryIsEnglish() ? (loc.titleEn || loc.title) : loc.title; return `<div class="flex items-center gap-2 min-w-0"><span class="w-7 h-7 rounded-full ${done ? 'bg-emerald-600' : (itineraryJourneyActive && idx === activeItineraryIndex ? 'bg-brandDark' : 'bg-brandGold')} text-white grid place-items-center text-[10px] font-black flex-shrink-0">${done ? '<i class="fa-solid fa-check"></i>' : idx + 1}</span><span class="text-xs ${done ? 'text-emerald-700 line-through' : 'text-brandDark'} font-bold truncate">${escapeHTML(name)}</span></div>`; }).join('');
    container.innerHTML += `<section class="rounded-2xl bg-white border border-orange-100 p-4"><div class="flex items-center justify-between gap-3 mb-3"><div><p class="text-[10px] uppercase tracking-[.15em] text-brandGold font-black">${itineraryText('Tu recorrido','Your route')}</p><p class="text-xs text-gray-500 mt-1">${itineraryText('Sigue las paradas en este orden.','Follow the stops in this order.')}</p></div><button type="button" onclick="openFullItineraryRoute()" class="rounded-xl bg-sky-50 border border-sky-100 text-sky-700 px-3 py-2 text-[10px] font-black"><i class="fa-solid fa-map mr-1"></i>${itineraryText('Ver mapa','View map')}</button></div><div class="grid sm:grid-cols-2 gap-2">${routeNames}</div></section>`;

    favoriteLocations.forEach((id, idx) => {
        const loc = locations.find(l => String(l.id) === String(id)); if (!loc) return;
        const locTitle = itineraryIsEnglish() ? (loc.titleEn || loc.title) : loc.title, locTag = itineraryIsEnglish() ? (loc.tagEn || loc.tag) : loc.tag, locAddress = itineraryIsEnglish() ? (loc.addressEn || loc.address || '') : (loc.address || '');
        const done = itineraryCompletedStops.has(String(id)), isCurrent = itineraryJourneyActive && idx === activeItineraryIndex;
        const shareText = itineraryIsEnglish() ? `📍 Stop #${idx+1} on my Visita Loja route: ${locTitle} (${locAddress}). Join me!` : `📍 Parada #${idx+1} en mi ruta de Visita Loja: *${locTitle}* (${locTag})\n📍 ${locAddress}\n¡Te lo recomiendo!`;
        const safeId = String(loc.id).replace(/'/g,"\\'");
        container.innerHTML += `<div class="bg-white border ${isCurrent ? 'border-brandGold ring-2 ring-orange-100' : 'border-brandGold/30'} rounded-xl p-3 shadow-sm ${done ? 'opacity-70' : ''}"><div class="flex items-center gap-3"><span class="w-7 h-7 rounded-full ${done ? 'bg-emerald-600' : (isCurrent ? 'bg-brandDark' : 'bg-brandGold')} text-white font-bold text-xs flex items-center justify-center flex-shrink-0">${done ? '<i class="fa-solid fa-check"></i>' : idx + 1}</span><img src="${loc.gallery?.[0]?.img || ''}" class="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt="" decoding="async" loading="lazy"><div class="min-w-0 flex-1"><h4 class="font-bold text-xs text-brandDark truncate">${escapeHTML(locTitle)}</h4><span class="text-[10px] text-brandGold font-bold block">${escapeHTML(locTag || '')}</span><span class="text-[10px] text-gray-500 block truncate">${escapeHTML(locAddress)}</span></div>${done ? `<span class="text-[9px] font-black text-emerald-700">${itineraryText('VISITADA','VISITED')}</span>` : ''}</div><div class="grid grid-cols-5 gap-1.5 mt-3"><button type="button" onclick="moveItineraryStop('${safeId}', -1)" ${idx === 0 || itineraryJourneyActive ? 'disabled' : ''} class="h-9 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-25"><i class="fa-solid fa-arrow-up"></i></button><button type="button" onclick="moveItineraryStop('${safeId}', 1)" ${idx === favoriteLocations.length - 1 || itineraryJourneyActive ? 'disabled' : ''} class="h-9 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-25"><i class="fa-solid fa-arrow-down"></i></button><button type="button" onclick="goToItineraryStop(${idx})" class="h-9 rounded-lg bg-sky-50 text-sky-700 border border-sky-100"><i class="fa-solid fa-diamond-turn-right"></i></button><a href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener noreferrer" class="h-9 rounded-lg bg-green-500 text-white flex items-center justify-center"><i class="fa-brands fa-whatsapp"></i></a><button type="button" onclick="removeFavorite('${safeId}')" ${itineraryJourneyActive ? 'disabled' : ''} class="h-9 rounded-lg bg-red-50 text-red-500 border border-red-100 disabled:opacity-25"><i class="fa-solid fa-trash"></i></button></div></div>`;
    });
}

window.addEventListener('languagechange', () => { if (typeof updateItineraryUI === 'function') updateItineraryUI(); });
window.addEventListener('beforeunload', stopItineraryGeolocation);
if (itineraryJourneyActive) setTimeout(startItineraryGeolocation, 0);
