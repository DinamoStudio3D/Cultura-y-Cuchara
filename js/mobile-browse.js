(() => {
    'use strict';
    const main = document.getElementById('main-content');
    if (!main || document.documentElement.classList.contains('fiavl-program-page')) return;
    const media = matchMedia('(max-width: 767px)');
    const homeIds = new Set(['inicio', 'mobileExploreHub', 'registeredBrands', 'banco-de-loja-destacado']);
    let current = 'inicio';
    const roots = () => [
        ...main.querySelectorAll(':scope > section'),
        ...document.querySelectorAll('body > #loja-en-imagenes, body > #loja-en-video')
    ];
    const hub = document.createElement('section');
    hub.id = 'mobileExploreHub';
    hub.className = 'vl-mobile-hub';
    hub.setAttribute('aria-labelledby', 'mobileExploreTitle');
    hub.innerHTML = "<div class=\"vl-mobile-hub-heading\"><div><p class=\"vl-mobile-eyebrow\">Loja, Ecuador</p><h2 id=\"mobileExploreTitle\">Encuentra tu próximo plan</h2></div><a href=\"#mapa\" class=\"vl-mobile-map-link\"><i class=\"fa-solid fa-map-location-dot\" aria-hidden=\"true\"></i> Ver mapa</a></div>\n<nav class=\"vl-mobile-intents\" aria-label=\"Elige qué descubrir\">\n<a href=\"#establecimientos\" data-mobile-category=\"food\"><i class=\"fa-solid fa-utensils\" aria-hidden=\"true\"></i><span>Comer</span></a>\n<a href=\"#establecimientos\" data-mobile-category=\"hotel\"><i class=\"fa-solid fa-bed\" aria-hidden=\"true\"></i><span>Hospedarse</span></a>\n<a href=\"#establecimientos\" data-mobile-category=\"turismo\"><i class=\"fa-solid fa-compass\" aria-hidden=\"true\"></i><span>Visitar</span></a>\n</nav>\n<div class=\"vl-mobile-stories\">\n<a href=\"#loja-en-imagenes\"><img src=\"assets/photos/jipiro-laguna.webp\" alt=\"Laguna del parque Jipiro\" loading=\"lazy\" decoding=\"async\"><span><strong>Loja en imágenes</strong><small>Rincones para descubrir</small></span><i class=\"fa-solid fa-arrow-up-right-from-square\" aria-hidden=\"true\"></i></a>\n<a href=\"#loja-en-video\"><img src=\"assets/photos/centro-loja-torre-reloj.webp\" alt=\"Centro histórico de Loja\" loading=\"lazy\" decoding=\"async\"><span><strong>Historias en video</strong><small>Conoce cada lugar</small></span><i class=\"fa-solid fa-circle-play\" aria-hidden=\"true\"></i></a>\n</div>\n<a class=\"vl-mobile-passport-link\" href=\"#pasaporte\"><i class=\"fa-solid fa-stamp\" aria-hidden=\"true\"></i><span><small>Cada visita cuenta</small><strong>Tu pasaporte de Loja</strong><span>Consulta tus sellos y recompensas</span></span><span aria-hidden=\"true\">→</span></a>\n<div class=\"vl-mobile-secondary-links\"><a href=\"#agenda\"><i class=\"fa-regular fa-calendar\" aria-hidden=\"true\"></i> Agenda de eventos</a><a href=\"#misiones\"><i class=\"fa-solid fa-compass\" aria-hidden=\"true\"></i> Misiones de Chabaquito</a></div>\n<details><summary>Más para descubrir <span aria-hidden=\"true\">＋</span></summary><div class=\"vl-mobile-more\"><a href=\"#emprendedores\">Emprendedores</a><a href=\"#postales\">Crear una postal</a><a href=\"#loja-tiempo\">Loja en el tiempo</a><a href=\"#podcast\">Podcast</a><a href=\"#especias\">Sabores y tradiciones</a><a href=\"#fiavl\">Festival FIAVL</a><a href=\"cantones.html\">Cantones de Loja</a><a href=\"tienda.html\">Tienda</a><button type=\"button\" data-mobile-route>Planificar una ruta</button><button type=\"button\" data-mobile-guide>Hablar con Chabaquito</button></div></details>";
    hub.querySelectorAll('[data-mobile-category]').forEach(link => {
        link.addEventListener('click', () => window.openCategoryList?.(link.dataset.mobileCategory));
    });
    hub.querySelector('[data-mobile-route]').addEventListener('click', () => window.openSmartRoutePlanner?.());
    hub.querySelector('[data-mobile-guide]').addEventListener('click', () => window.ChabaquitoGuide?.open());
    const videoLink = hub.querySelector('a[href="#loja-en-video"]');
    const videoGallery = document.getElementById('loja-en-video');
    videoLink.hidden = !videoGallery || videoGallery.hidden;
    if (videoGallery) new MutationObserver(() => {
        videoLink.hidden = videoGallery.hidden;
    }).observe(videoGallery, { attributes: true, attributeFilter: ['hidden'] });
    document.getElementById('inicio')?.after(hub);
    const bar = document.createElement('nav');
    bar.className = 'vl-mobile-bottom';
    bar.setAttribute('aria-label', 'Navegación móvil');
    bar.innerHTML = [
        ['inicio', 'fa-house', 'Inicio'],
        ['establecimientos', 'fa-compass', 'Explorar'],
        ['mapa', 'fa-map-location-dot', 'Mapa']
    ].map(([id, icon, label]) => '<a href="#' + id + '"><i class="fa-solid ' + icon + '" aria-hidden="true"></i><span>' + label + '</span></a>').join('') +
        '<button type="button" aria-haspopup="dialog" aria-controls="accountModal"><i class="fa-solid fa-circle-user" aria-hidden="true"></i><span>Mi cuenta</span></button>';
    bar.querySelector('button').addEventListener('click', () => document.getElementById('accountNavButton')?.click());
    document.body.append(bar);
    const back = document.createElement('div');
    back.className = 'vl-mobile-section-back';
    back.innerHTML = '<a href="#inicio"><span aria-hidden="true">‹</span> Volver al inicio</a><span></span>';
    main.prepend(back);
    const controls = document.querySelector('#establecimientos .discovery-controls');
    let filters;
    if (controls) {
        filters = document.createElement('details');
        filters.className = 'vl-mobile-search-filters';
        filters.innerHTML = '<summary>Cantón y horario <span aria-hidden="true">⌄</span></summary>';
        controls.before(filters);
        filters.append(controls);
        filters.open = !media.matches;
    }
    function syncTyping() {
        const field = document.activeElement;
        const editing = field && (
            field.tagName === 'TEXTAREA' ||
            field.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range', 'file', 'color'].includes(field.type)
        );
        document.documentElement.classList.toggle('vl-mobile-typing', Boolean(media.matches && editing));
    }
    document.addEventListener('focusin', syncTyping);
    document.addEventListener('focusout', () => requestAnimationFrame(syncTyping));

    function rootFor(id) {
        const element = document.getElementById(id);
        return roots().find(root => root === element || root.contains(element));
    }
    function render() {
        const active = media.matches;
        document.documentElement.classList.toggle('vl-mobile-browse', active);
        const selected = rootFor(current);
        const home = current === 'inicio' || !selected;
        for (const root of roots()) {
            const visible = home ? homeIds.has(root.id) : root === selected;
            root.toggleAttribute('data-mobile-away', !visible);
        }
        hub.hidden = !home;
        back.hidden = home;
        back.querySelector('span:last-child').textContent = selected?.querySelector('h2')?.textContent?.trim() || '';
        for (const link of bar.querySelectorAll('a')) {
            const selectedLink = link.hash === '#' + (home ? 'inicio' : selected?.id === 'categorias' ? 'establecimientos' : selected?.id);
            if (selectedLink) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        }
        if (active && !home) {
            selected?.classList.add('active');
            requestAnimationFrame(() => {
                // Leaflet measures its container only after the section becomes visible.
                if (selected?.id === 'mapa') window.dispatchEvent(new Event('resize'));
            });
        }
    }
    function open(id) {
        if (!media.matches || !document.getElementById(id)) return;
        current = id;
        render();
        if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    }
    window.VisitaLojaMobileBrowse = { open };
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
        const id = decodeURIComponent(url.hash.slice(1));
        if (id === 'inicio' || rootFor(id)) open(id);
    }, true);
    function fromHash() {
        let id;
        try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
        if (!id) current = 'inicio';
        else if (id === 'inicio' || rootFor(id)) current = id;
        else current = 'inicio';
        render();
        if (media.matches && id && rootFor(id)) {
            requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
        }
    }
    window.addEventListener('hashchange', fromHash);
    media.addEventListener('change', () => {
        if (filters) filters.open = !media.matches;
        syncTyping();
        render();
    });
    // Public sections can be inserted after Firestore settings arrive.
    new MutationObserver(render).observe(main, { childList: true });
    fromHash();
})();

