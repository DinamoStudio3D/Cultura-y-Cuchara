/* Visita Loja — módulo Mi Ruta. */

let activeItineraryIndex = Math.max(0, Number.parseInt(localStorage.getItem('cyc_active_itinerary_index') || '0', 10) || 0);
let itineraryJourneyActive = localStorage.getItem('cyc_itinerary_journey_active') === '1';

function itineraryIsEnglish() { return typeof currentLang !== 'undefined' && currentLang === 'en'; }
function itineraryText(es, en) { return itineraryIsEnglish() ? en : es; }

function saveItineraryJourneyState() {
    localStorage.setItem('cyc_active_itinerary_index', String(activeItineraryIndex));
    localStorage.setItem('cyc_itinerary_journey_active', itineraryJourneyActive ? '1' : '0');
}

function moveItineraryStop(id, direction) {
    const index = favoriteLocations.indexOf(String(id));
    if (index < 0) return;
    const target = index + Number(direction);
    if (target < 0 || target >= favoriteLocations.length) return;
    [favoriteLocations[index], favoriteLocations[target]] = [favoriteLocations[target], favoriteLocations[index]];
    if (itineraryJourneyActive) {
        if (activeItineraryIndex === index) activeItineraryIndex = target;
        else if (activeItineraryIndex === target) activeItineraryIndex = index;
    }
    persistFavorites();
    saveItineraryJourneyState();
    updateItineraryUI();
}

function itineraryDirectionsUrl(loc) {
    const lat = Number(loc?.lat), lng = Number(loc?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc?.address || loc?.title || 'Loja, Ecuador')}`;
}

function startItineraryJourney() {
    if (!favoriteLocations.length) { showToast(itineraryText('Agrega al menos una parada a Mi Ruta.','Add at least one stop to My Route.')); return; }
    activeItineraryIndex = Math.min(activeItineraryIndex, favoriteLocations.length - 1);
    itineraryJourneyActive = true;
    saveItineraryJourneyState();
    updateItineraryUI();
    showToast(itineraryText('Recorrido iniciado. Tu primera parada está lista.','Route started. Your first stop is ready.'));
}

function goToItineraryStop(index) {
    if (!favoriteLocations.length) return;
    activeItineraryIndex = Math.max(0, Math.min(Number(index) || 0, favoriteLocations.length - 1));
    itineraryJourneyActive = true;
    saveItineraryJourneyState();
    updateItineraryUI();
    const loc = locations.find(l => l.id === favoriteLocations[activeItineraryIndex]);
    if (loc) window.open(itineraryDirectionsUrl(loc), '_blank', 'noopener,noreferrer');
}

function completeCurrentItineraryStop() {
    if (!itineraryJourneyActive || !favoriteLocations.length) return;
    if (activeItineraryIndex >= favoriteLocations.length - 1) {
        itineraryJourneyActive = false;
        activeItineraryIndex = 0;
        saveItineraryJourneyState();
        updateItineraryUI();
        showToast(itineraryText('¡Recorrido completado!','Route completed!'));
        return;
    }
    activeItineraryIndex += 1;
    saveItineraryJourneyState();
    updateItineraryUI();
    showToast(itineraryText('Siguiente parada preparada.','Next stop ready.'));
}

function updateItineraryUI() {
    renderVisitorExperience();
    const container = document.getElementById('itineraryListContainer');
    const badge = document.getElementById('itineraryBadge');
    const startButton = document.getElementById('startItineraryButton');
    if(!container) return;
    container.innerHTML = '';

    if(favoriteLocations.length === 0) {
        itineraryJourneyActive = false;
        activeItineraryIndex = 0;
        saveItineraryJourneyState();
        container.innerHTML = `<div class="text-center py-12 text-gray-400 text-xs"><i class="fa-solid fa-route text-4xl mb-3 text-gray-300"></i><br><strong class="text-brandDark text-sm block mb-1">${itineraryText('Tu ruta está vacía','Your route is empty')}</strong>${itineraryText('Toca el icono de hoja en cualquier tarjeta o pin del mapa para organizar tus paradas favoritas.','Tap the leaf icon on any card or map pin to organize your favorite stops.')}</div>`;
        if(badge) badge.classList.add('hidden');
        if(startButton) startButton.classList.add('hidden');
        return;
    }

    activeItineraryIndex = Math.min(activeItineraryIndex, favoriteLocations.length - 1);
    if(badge) {
        badge.innerText = favoriteLocations.length;
        badge.classList.remove('hidden');
    }
    if(startButton) {
        startButton.classList.remove('hidden');
        startButton.innerHTML = itineraryJourneyActive
            ? `<i class="fa-solid fa-location-arrow"></i><span>${itineraryText('Continuar recorrido','Continue route')}</span>`
            : `<i class="fa-solid fa-route"></i><span>${itineraryText('Iniciar recorrido','Start route')}</span>`;
    }

    if (itineraryJourneyActive) {
        const current = locations.find(l => l.id === favoriteLocations[activeItineraryIndex]);
        if (current) {
            const title = (itineraryIsEnglish() && current.titleEn) ? current.titleEn : current.title;
            const address = itineraryIsEnglish() ? (current.addressEn || current.address || '') : (current.address || '');
            const lastStop = activeItineraryIndex === favoriteLocations.length - 1;
            const completionLabel = lastStop
                ? `<i class="fa-solid fa-flag-checkered mr-1"></i>${itineraryText('Finalizar','Finish')}`
                : `<i class="fa-solid fa-check mr-1"></i>${itineraryText('Siguiente parada','Next stop')}`;
            container.innerHTML += `<section class="rounded-2xl bg-brandDark text-white border border-brandGold/40 p-4 shadow-lg"><div class="flex items-start justify-between gap-3"><div><p class="text-[10px] uppercase tracking-[.18em] text-brandGold font-black">${itineraryText('Parada actual','Current stop')} · ${activeItineraryIndex + 1} ${itineraryText('de','of')} ${favoriteLocations.length}</p><h4 class="font-black text-base mt-1">${escapeHTML(title)}</h4><p class="text-xs text-gray-300 mt-1">${escapeHTML(address)}</p></div><span class="w-9 h-9 rounded-full bg-brandGold text-white grid place-items-center font-black">${activeItineraryIndex + 1}</span></div><div class="grid grid-cols-2 gap-2 mt-4"><button type="button" onclick="goToItineraryStop(${activeItineraryIndex})" class="bg-brandGold text-white rounded-xl py-2.5 text-xs font-black"><i class="fa-solid fa-diamond-turn-right mr-1"></i>${itineraryText('Cómo llegar','Directions')}</button><button type="button" onclick="completeCurrentItineraryStop()" class="bg-white/10 border border-white/15 text-white rounded-xl py-2.5 text-xs font-black">${completionLabel}</button></div></section>`;
        }
    } else {
        container.innerHTML += `<div class="rounded-xl bg-orange-50 border border-orange-100 p-3 text-xs text-orange-900"><i class="fa-solid fa-hand-pointer text-brandGold mr-2"></i><strong>${itineraryText('Ordena tus paradas','Organize your stops')}</strong> ${itineraryText('con las flechas y luego pulsa','with the arrows, then tap')} <strong>${itineraryText('Iniciar recorrido','Start route')}</strong>.</div>`;
    }

    favoriteLocations.forEach((id, idx) => {
        const loc = locations.find(l => l.id === id);
        if(!loc) return;
        const locTitle = (itineraryIsEnglish() && loc.titleEn) ? loc.titleEn : loc.title;
        const locTag = (itineraryIsEnglish() && loc.tagEn) ? loc.tagEn : loc.tag;
        const locAddress = itineraryIsEnglish() ? (loc.addressEn || loc.address || '') : (loc.address || '');
        const isCurrent = itineraryJourneyActive && idx === activeItineraryIndex;
        const shareText = itineraryIsEnglish()
            ? `📍 Stop #${idx+1} on my Visita Loja route: ${locTitle} (${locAddress}). Join me!`
            : `📍 Parada #${idx+1} en mi ruta de Visita Loja: *${locTitle}* (${locTag})\n📍 ${locAddress}\n¡Te lo recomiendo!`;
        const safeId = String(loc.id).replace(/'/g,"\\'");

        container.innerHTML += `<div class="bg-white border ${isCurrent ? 'border-brandGold ring-2 ring-orange-100' : 'border-brandGold/30'} rounded-xl p-3 shadow-sm"><div class="flex items-center gap-3"><span class="w-7 h-7 rounded-full ${isCurrent ? 'bg-brandDark' : 'bg-brandGold'} text-white font-bold text-xs flex items-center justify-center flex-shrink-0">${idx + 1}</span><img src="${loc.gallery && loc.gallery[0] ? loc.gallery[0].img : ''}" class="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt="" decoding="async" loading="lazy"><div class="min-w-0 flex-1"><h4 class="font-bold text-xs text-brandDark truncate">${escapeHTML(locTitle)}</h4><span class="text-[10px] text-brandGold font-bold block">${escapeHTML(locTag || '')}</span><span class="text-[10px] text-gray-500 block truncate">${escapeHTML(locAddress)}</span></div></div><div class="grid grid-cols-5 gap-1.5 mt-3"><button type="button" onclick="moveItineraryStop('${safeId}', -1)" ${idx === 0 ? 'disabled' : ''} class="h-9 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-25" title="${itineraryText('Subir parada','Move stop up')}"><i class="fa-solid fa-arrow-up"></i></button><button type="button" onclick="moveItineraryStop('${safeId}', 1)" ${idx === favoriteLocations.length - 1 ? 'disabled' : ''} class="h-9 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-25" title="${itineraryText('Bajar parada','Move stop down')}"><i class="fa-solid fa-arrow-down"></i></button><button type="button" onclick="goToItineraryStop(${idx})" class="h-9 rounded-lg bg-sky-50 text-sky-700 border border-sky-100" title="${itineraryText('Cómo llegar','Directions')}"><i class="fa-solid fa-diamond-turn-right"></i></button><a href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener noreferrer" class="h-9 rounded-lg bg-green-500 text-white flex items-center justify-center" title="${itineraryText('Compartir parada','Share stop')}"><i class="fa-brands fa-whatsapp"></i></a><button type="button" onclick="removeFavorite('${safeId}')" class="h-9 rounded-lg bg-red-50 text-red-500 border border-red-100" title="${itineraryText('Quitar de la ruta','Remove from route')}"><i class="fa-solid fa-trash"></i></button></div></div>`;
    });
}

// Mantiene Mi Ruta sincronizada al cambiar Español / English sin recargar la página.
window.addEventListener('languagechange', () => {
    if (typeof updateItineraryUI === 'function') updateItineraryUI();
});
