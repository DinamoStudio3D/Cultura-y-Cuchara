(() => {
    'use strict';
    const main = document.getElementById('main-content');
    if (!main || document.documentElement.classList.contains('fiavl-program-page')) return;
    const media = matchMedia('(max-width: 767px)');
    const homeIds = new Set(['inicio', 'registeredBrands', 'banco-de-loja-destacado', 'patrocinadores']);
    let current = 'inicio';
    const roots = () => [
        ...main.querySelectorAll(':scope > section'),
        ...document.querySelectorAll('body > #loja-en-imagenes, body > #loja-en-video')
    ];
    const hub = document.createElement('section');
    hub.id = 'mobileExploreHub';
    hub.className = 'vl-mobile-hub';
    hub.setAttribute('aria-labelledby', 'mobileExploreTitle');
    hub.innerHTML = '<p class="vl-mobile-eyebrow">A tu ritmo</p><h2 id="mobileExploreTitle">¿Qué te apetece hacer?</h2><p>Elige y descubre Loja sin dar tantas vueltas.</p><div class="vl-mobile-hub-grid">' +
        [
            ['establecimientos', 'fa-utensils', 'Comer y descubrir', 'Lugares y negocios'],
            ['agenda', 'fa-calendar-days', 'Ver eventos', 'Planea tu próxima salida'],
            ['pasaporte', 'fa-stamp', 'Mi pasaporte', 'Sellos y recompensas'],
            ['misiones', 'fa-compass', 'Con Chabaquito', 'Explora y cumple misiones'],
            ['loja-en-imagenes', 'fa-camera', 'Loja en imágenes', 'Una mirada a nuestra tierra'],
            ['loja-en-video', 'fa-circle-play', 'Loja en video', 'Conoce lugares e historias']
        ].map(([id, icon, title, subtitle]) => '<a href="#' + id + '"><i class="fa-solid ' + icon + '" aria-hidden="true"></i><span><strong>' + title + '</strong><small>' + subtitle + '</small></span><span aria-hidden="true">›</span></a>').join('') +
        '</div><details><summary>Más de Loja</summary><div class="vl-mobile-more"><a href="#emprendedores">Emprendedores</a><a href="#postales">Crear una postal</a><a href="#loja-tiempo">Loja en el tiempo</a><a href="#podcast">Podcast</a><a href="#especias">Sabores y tradiciones</a><a href="#fiavl">Festival FIAVL</a><a href="cantones.html">Conocer los cantones</a><a href="tienda.html">Tienda</a></div></details>';
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
        '<button type="button"><i class="fa-solid fa-circle-user" aria-hidden="true"></i><span>Mi cuenta</span></button>';
    bar.querySelector('button').addEventListener('click', () => window.openAccountModal?.());
    document.body.append(bar);
    const back = document.createElement('div');
    back.className = 'vl-mobile-section-back';
    back.innerHTML = '<a href="#inicio"><span aria-hidden="true">‹</span> Volver al inicio</a><span></span>';
    main.prepend(back);

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
            const visible = home ? homeIds.has(root.id) : root === selected ||
                (current === 'establecimientos' && root.id === 'categorias');
            root.toggleAttribute('data-mobile-away', !visible);
        }
        hub.hidden = !home;
        back.hidden = home;
        back.querySelector('span:last-child').textContent = selected?.querySelector('h2')?.textContent?.trim() || '';
        for (const link of bar.querySelectorAll('a')) {
            const selectedLink = link.hash === '#' + (home ? 'inicio' : current);
            if (selectedLink) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        }
        if (active && !home) {
            selected?.classList.add('active');
            requestAnimationFrame(() => {
                // Leaflet measures its container only after the section becomes visible.
                if (current === 'mapa') window.dispatchEvent(new Event('resize'));
            });
        }
    }
    function open(id) {
        if (!media.matches || !document.getElementById(id)) return;
        current = id;
        render();
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
        render();
        if (media.matches && id && rootFor(id)) {
            requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
        }
    }
    window.addEventListener('hashchange', fromHash);
    media.addEventListener('change', render);
    // Public sections can be inserted after Firestore settings arrive.
    new MutationObserver(render).observe(main, { childList: true });
    fromHash();
})();
