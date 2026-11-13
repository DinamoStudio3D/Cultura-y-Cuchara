/* A day-focused mobile view over the existing public agenda and saved events. */
(function (root) {
    'use strict';
    const dayAt = (now, offset = 0) => new Date(now - 5 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
    function activityTime(event) {
        const date = String(event.date || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { start: NaN, end: NaN };
        const timed = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(event.time || ''));
        const start = Date.parse(date + 'T' + (timed ? event.time : '00:00') + ':00-05:00');
        const duration = Number(event.durationMinutes);
        const end = timed && Number.isFinite(duration) && duration > 0
            ? start + duration * 60000
            : Date.parse(date + 'T00:00:00-05:00') + 86400000;
        return { start, end, timed };
    }
    function selectDay(items, date, now) {
        return items.filter(({event}) => event.date === date && activityTime(event).end > now)
            .sort((a, b) => {
                const first = activityTime(a.event), second = activityTime(b.event);
                const rank = time => !time.timed ? 2 : time.start >= now ? 0 : 1;
                return rank(first) - rank(second) || first.start - second.start;
            });
    }
    if (typeof module === 'object' && module.exports) {
        module.exports = { dayAt, activityTime, selectDay };
        return;
    }
    const section = root.document.getElementById('agenda');
    if (!section || root.document.documentElement.classList.contains('fiavl-program-page')) return;
    const mobile = root.matchMedia('(max-width: 767px)');
    const en = () => root.document.getElementById('langSelector')?.value === 'en';
    const text = (es, english) => en() ? english : es;
    let mode = 'today', customDate = '', limit = 10, saved = false;
    const dateFilter = root.document.getElementById('agendaDateFilter');
    const desktopDate = dateFilter?.value || 'all';
    const selectedDay = () => mode === 'tomorrow' ? dayAt(Date.now(), 1) : mode === 'custom' && customDate ? customDate : dayAt(Date.now());
    const header = root.document.createElement('div');
    header.className = 'vl-mobile-agenda-header';
    header.innerHTML = '<p class="vl-mobile-agenda-eyebrow"></p><h2></h2><p data-mobile-agenda-date></p><div class="vl-mobile-agenda-days" role="group" aria-label="Elegir día"><button type="button" data-mobile-agenda-day="today">Hoy</button><button type="button" data-mobile-agenda-day="tomorrow">Mañana</button><button type="button" data-mobile-agenda-day="custom">Elegir fecha</button></div><label class="vl-mobile-agenda-date-input" hidden><span>Fecha de tu plan</span><input type="date"></label>';
    const legacyHeader = section.querySelector('.vl-agenda-legacy-header');
    (legacyHeader || section.firstElementChild)?.before(header);
    const picker = header.querySelector('input');
    dateFilter?.closest('label')?.classList.add('vl-agenda-desktop-date');
    const refresh = () => root.document.dispatchEvent(new CustomEvent('visitaloja:mobile-agenda-refresh'));
    function choose(value) {
        mode = value;
        limit = 10;
        refresh();
        if (mode === 'custom') {
            picker.focus();
            try { picker.showPicker?.(); } catch {}
        }
    }
    header.querySelectorAll('[data-mobile-agenda-day]').forEach(button => {
        button.addEventListener('click', () => choose(button.dataset.mobileAgendaDay));
    });
    picker.addEventListener('change', () => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(picker.value)) return;
        customDate = picker.value;
        mode = 'custom';
        limit = 10;
        refresh();
    });
    section.addEventListener('click', event => {
        const button = event.target.closest('[data-mobile-agenda-empty]');
        if (button) choose(button.dataset.mobileAgendaEmpty);
    });
    function onRender(isSaved) {
        saved = isSaved;
        const date = selectedDay();
        header.querySelector('h2').textContent = saved
            ? text('Mis eventos guardados', 'My saved events')
            : mode === 'today' ? text('Hoy en Loja', 'Today in Loja')
            : mode === 'tomorrow' ? text('Mañana en Loja', 'Tomorrow in Loja') : text('Tu agenda en Loja', 'Your Loja agenda');
        header.querySelector('.vl-mobile-agenda-eyebrow').textContent = text('Cultura y experiencias', 'Culture and experiences');
        header.querySelector('[data-mobile-agenda-date]').textContent = saved
            ? text('Tus planes para volver a encontrarlos.', 'Your plans, ready when you need them.')
            : new Intl.DateTimeFormat(en() ? 'en-US' : 'es-EC', {weekday:'long', day:'numeric', month:'long', timeZone:'America/Guayaquil'}).format(new Date(date + 'T12:00:00-05:00'));
        header.querySelector('.vl-mobile-agenda-days').hidden = saved;
        header.querySelector('label').hidden = saved || mode !== 'custom';
        header.querySelector('label span').textContent = text('Fecha de tu plan', 'Choose your date');
        const labels = [text('Hoy','Today'), text('Mañana','Tomorrow'), text('Elegir fecha','Choose date')];
        header.querySelectorAll('[data-mobile-agenda-day]').forEach((button, index) => {
            button.textContent = labels[index];
            button.setAttribute('aria-pressed', String(button.dataset.mobileAgendaDay === mode));
        });
        picker.min = dayAt(Date.now());
        picker.value = date;
        const allLabel = root.document.querySelector('#agendaAllButton span');
        if (mobile.matches && allLabel) allLabel.textContent = text('Agenda', 'Agenda');
    }
    function enhance(items) {
        if (!mobile.matches) return;
        const cards = [...section.querySelectorAll('#agendaGridContainer > .vl-agenda-card')];
        cards.forEach((card, index) => {
            const item = items[index];
            if (!item) return;
            const event = item.event;
            const time = activityTime(event);
            const summary = root.document.createElement('div');
            summary.className = 'vl-mobile-event-summary';
            const clock = root.document.createElement('div');
            clock.className = 'vl-mobile-event-clock';
            const strong = root.document.createElement('strong');
            strong.textContent = time.timed ? event.time : text('Sin hora', 'No time');
            const status = root.document.createElement('small');
            status.textContent = saved ? event.date || '' : time.timed && time.start < Date.now() ? text('Ya inició', 'Started') : text('Próximamente', 'Upcoming');
            clock.append(strong, status);
            const info = root.document.createElement('div');
            const type = root.document.createElement('span');
            type.className = 'vl-mobile-event-type';
            type.textContent = event.category || event.type || (item.kind === 'festival' ? 'FIAVL' : text('Evento', 'Event'));
            const title = root.document.createElement('h3');
            title.textContent = (en() && event.titleEn ? event.titleEn : event.title) || text('Actividad en Loja', 'Event in Loja');
            const place = root.document.createElement('p');
            place.textContent = event.location || event.place || text('Ubicación por confirmar', 'Location to confirm');
            info.append(type, title, place);
            summary.append(clock, info);
            const media = card.querySelector('.vl-agenda-media');
            const body = card.querySelector('.vl-agenda-card-body');
            const bookmark = media?.querySelector('button[aria-pressed]');
            const directions = card.querySelector('.vl-agenda-card-actions a');
            const details = root.document.createElement('details');
            details.className = 'vl-mobile-event-details';
            const toggle = root.document.createElement('summary');
            toggle.textContent = media?.querySelector('img') ? text('Detalles y afiche', 'Details and poster') : text('Ver detalles', 'View details');
            details.append(toggle);
            if (media) details.append(media);
            if (body) details.append(body);
            card.replaceChildren(summary);
            if (bookmark) { bookmark.classList.add('vl-mobile-event-save'); card.append(bookmark); }
            card.append(details);
            card.toggleAttribute('data-mobile-event-directions', Boolean(directions));
            if (directions) { directions.classList.add('vl-mobile-event-directions'); card.append(directions); }
        });
    }
    function empty() {
        if (!mobile.matches || saved) return '';
        return '<div class="vl-mobile-agenda-empty"><h3>' + text('No hay más actividades para esta fecha', 'No more activities for this date') +
            '</h3><p>' + text('Prueba mañana o elige otro día para descubrir qué sucede en Loja.', 'Try tomorrow or choose another day to discover Loja.') +
            '</p><button type="button" data-mobile-agenda-empty="tomorrow">' + text('Ver mañana', 'See tomorrow') + '</button><button type="button" data-mobile-agenda-empty="custom">' + text('Elegir fecha', 'Choose date') + '</button></div>';
    }
    root.VisitaLojaMobileAgenda = {
        active: () => mobile.matches,
        select: (items, options) => mobile.matches && !options.saved ? selectDay(items, selectedDay(), options.now) : items,
        pageLimit: desktop => mobile.matches ? limit : desktop,
        more: () => { if (!mobile.matches) return false; limit += 10; return true; },
        reset: () => { limit = 10; },
        onRender, enhance, empty
    };
    function synchronize() {
        if (dateFilter) dateFilter.value = mobile.matches ? 'all' : desktopDate;
        if (!mobile.matches) {
            const allLabel = root.document.querySelector('#agendaAllButton span');
            if (allLabel) allLabel.textContent = text('Todos', 'All');
        }
        refresh();
    }
    mobile.addEventListener('change', synchronize);
    root.addEventListener('languagechange', refresh);
    root.document.addEventListener('visibilitychange', () => { if (!root.document.hidden && mobile.matches) refresh(); });
    root.setInterval(() => {
        if (mobile.matches && !root.document.hidden && !section.hasAttribute('data-mobile-away') &&
            !section.querySelector('details[open]') && !section.querySelector('input:focus, select:focus, textarea:focus')) refresh();
    }, 60000);
    synchronize();
})(typeof window === 'object' ? window : globalThis);
