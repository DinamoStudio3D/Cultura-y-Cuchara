/* Focused mobile place browsing. All business actions use the existing public panels. */
(() => {
    'use strict';
    const browse = window.VisitaLojaMobileBrowse;
    if (!browse) return;
    const mobile = matchMedia('(max-width: 767px)');
    const key = 'vl-mobile-place-browse-v1';
    const list = document.getElementById('establecimientos');
    const card = document.getElementById('mapPreviewCard');
    const gps = document.getElementById('previewGps');
    const english = () => document.getElementById('langSelector')?.value === 'en';
    const text = (es, en) => english() ? en : es;
    let snapshot = null;
    let restoring = false;
    let restoreGeneration = 0;
    let selectedId = null;
    let pendingRestore = null;
    let lastSection = location.hash.slice(1) || 'inicio';
    let noticeUntil = 0;
    const startedAt = Date.now();
    try {
        const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
        if (saved?.version === 1 && Date.now() - saved.savedAt < 30 * 60 * 1000) snapshot = saved;
    } catch {}

    function persist() {
        if (!mobile.matches || restoring) return;
        snapshot = {
            version: 1, savedAt: Date.now(), scrollY: window.scrollY,
            query: document.getElementById('searchInput')?.value || '',
            cantonId: document.getElementById('placeCantonFilter')?.value || '',
            openOnly: document.getElementById('placeOpenFilter')?.checked === true,
            savedOnly: document.getElementById('placeSavedFilter')?.checked === true,
            category: document.querySelector('#categoryScroll .filter-btn[aria-pressed="true"]')?.dataset.placeCategory || 'all'
        };
        try { sessionStorage.setItem(key, JSON.stringify(snapshot)); } catch {}
    }
    function command(action, detail = {}) {
        document.dispatchEvent(new CustomEvent('visitaloja:mobile-place-filter', { detail: { action, ...detail } }));
    }
    const chips = document.createElement('div');
    chips.className = 'vl-mobile-active-filters';
    chips.setAttribute('aria-label', 'Filtros activos');
    const chipHost = document.createElement('div');
    chipHost.className = 'vl-mobile-filter-chips';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = text('Limpiar filtros', 'Clear filters');
    reset.addEventListener('click', () => command('clear'));
    chips.append(chipHost, reset);
    chips.hidden = true;
    document.getElementById('smartSearchStatus')?.parentElement?.append(chips);

    function filtersChanged(state) {
        if (restoring && snapshot && ['query', 'category', 'cantonId', 'openOnly', 'savedOnly'].some(key => state[key] !== snapshot[key])) {
            restoreGeneration++;
            restoring = false;
        }
        chipHost.replaceChildren();
        const category = document.querySelector('#categoryScroll .filter-btn[aria-pressed="true"]');
        const canton = document.getElementById('placeCantonFilter');
        const values = [
            ['query', state.query],
            ['category', state.category !== 'all' ? category?.textContent.trim() || state.category : ''],
            ['cantonId', state.cantonId ? canton?.selectedOptions?.[0]?.textContent || state.cantonId : ''],
            ['openOnly', state.openOnly ? text('Abierto ahora', 'Open now') : ''],
            ['savedOnly', state.savedOnly ? text('Mis favoritos', 'My favorites') : '']
        ].filter(([, label]) => label);
        for (const [filter, label] of values) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label + ' ×';
            button.setAttribute('aria-label', text('Quitar filtro: ', 'Remove filter: ') + label);
            button.addEventListener('click', () => command('remove', { filter }));
            chipHost.append(button);
        }
        chips.hidden = values.length === 0;
        reset.textContent = text('Limpiar filtros', 'Clear filters');
    }
    function restoreList() {
        if (!mobile.matches || !snapshot) return;
        restoring = true;
        const generation = ++restoreGeneration;
        command('restore', { state: snapshot });
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (generation !== restoreGeneration) return;
            window.scrollTo({ top: Math.max(0, Number(snapshot.scrollY) || 0), behavior: 'instant' });
            restoring = false;
        }));
    }
    function beforeSectionChange(previous, next) {
        if (previous === 'establecimientos' && next !== previous) persist();
        lastSection = next;
    }
    function afterSectionChange(previous, next) {
        if (next === 'establecimientos' && previous !== next) restoreList();
    }
    document.addEventListener('click', event => {
        if (!mobile.matches || !list?.contains(event.target)) return;
        if (event.target.closest('.local-item')) persist();
    }, true);
    window.addEventListener('pagehide', () => {
        if (lastSection === 'establecimientos') persist();
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted && location.hash === '#establecimientos') restoreList();
    });

    let sheet;
    let gpsHome;
    if (card) {
        sheet = document.createElement('div');
        sheet.className = 'vl-mobile-map-summary';
        sheet.innerHTML = '<div><strong></strong><small></small></div><button type="button" data-sheet-close aria-label="Cerrar ficha">×</button><div class="vl-mobile-map-summary-actions"><a href="#establecimientos">Volver a Paradas</a><button type="button" data-sheet-expand aria-expanded="false">Ver detalles</button></div>';
        card.prepend(sheet);
        const expand = sheet.querySelector('[data-sheet-expand]');
        expand.addEventListener('click', () => {
            const expanded = card.dataset.mobileExpanded !== 'true';
            card.dataset.mobileExpanded = String(expanded);
            expand.setAttribute('aria-expanded', String(expanded));
            expand.textContent = expanded ? text('Reducir ficha', 'Collapse details') : text('Ver detalles', 'View details');
        });
        sheet.querySelector('[data-sheet-close]').addEventListener('click', () => {
            card.dataset.mobileDismissed = 'true';
            document.querySelector('#mapa .leaflet-container')?.focus({ preventScroll: true });
        });
        if (gps) {
            gpsHome = document.createComment('Original directions action');
            gps.before(gpsHome);
        }
    }
    function arrangeDirections() {
        if (!gps || !sheet) return;
        if (mobile.matches) sheet.querySelector('.vl-mobile-map-summary-actions').append(gps);
        else gpsHome.after(gps);
    }
    function selection(id, userInitiated = true) {
        if (!card || !sheet) return;
        sheet.querySelector('strong').textContent = document.getElementById('previewTitle')?.textContent || '';
        sheet.querySelector('small').textContent = document.getElementById('previewOpenStatus')?.textContent || '';
        if (id === selectedId && !userInitiated) return;
        selectedId = id;
        card.dataset.mobileDismissed = 'false';
        card.dataset.mobileExpanded = 'false';
        const expand = sheet.querySelector('[data-sheet-expand]');
        expand.setAttribute('aria-expanded', 'false');
        expand.textContent = text('Ver detalles', 'View details');
    }
    function modalVisible() {
        return [...document.querySelectorAll('[role="dialog"][aria-modal="true"], dialog[open]')]
            .some(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0);
    }
    function canShowNotice(kind = 'promotion') {
        if (!mobile.matches) return true;
        if (document.hidden || modalVisible() || document.documentElement.classList.contains('vl-mobile-typing')) return false;
        if (Date.now() < noticeUntil) return false;
        if (kind === 'install') {
            return (location.hash === '' || location.hash === '#inicio') && Date.now() - startedAt >= 20000;
        }
        return !document.getElementById('vl-chabaquito-install')?.classList.contains('vl-install-visible');
    }
    function pauseNotices() { noticeUntil = Date.now() + 15000; }
    document.addEventListener('focusin', event => {
        if (event.target.matches('input, textarea, select')) pauseNotices();
    });
    document.addEventListener('click', event => {
        if (event.target.closest('#vl-install-close, #vl-install-later, #promoPopupModal button')) pauseNotices();
    });
    window.VisitaLojaMobilePlaces = { filtersChanged, beforeSectionChange, afterSectionChange, selection, canShowNotice };
    arrangeDirections();
    if (card?.dataset.empty === 'false') selection(null, false);
    mobile.addEventListener('change', arrangeDirections);
    window.addEventListener('languagechange', () => {
        command('refresh');
        selection(selectedId, false);
    });
    function restorePendingFilters() {
        if (!pendingRestore || !mobile.matches) return;
        const canton = document.getElementById('placeCantonFilter');
        if (pendingRestore.cantonId && ![...canton.options].some(option => option.value === pendingRestore.cantonId)) return;
        command('restore', { state: pendingRestore });
        pendingRestore = null;
    }
    window.addEventListener('visitaloja:places-rendered', restorePendingFilters);
    list?.addEventListener('input', () => { pendingRestore = null; });
    list?.addEventListener('change', () => { pendingRestore = null; });
    if (snapshot && mobile.matches) {
        pendingRestore = snapshot;
        restorePendingFilters();
        if (location.hash === '#establecimientos') restoreList();
        try {
            const referrer = new URL(document.referrer);
            if (!location.hash && referrer.origin === location.origin && referrer.pathname.startsWith('/parada/')) {
                browse.open('establecimientos');
            }
        } catch {}
    } else command('refresh');
})();
