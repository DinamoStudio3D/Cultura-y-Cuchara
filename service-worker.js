const CACHE_NAME = 'visita-loja-shell-v11';
const LOCAL_SHELL = ['./', './index.html', './manifest.webmanifest?v=6', './mascota-vive-loja.png', './visita-loja-icon-512.png', './visita-loja-maskable-512.png'];
const OFFLINE_HTML = '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sin conexión</title><body style="font-family:system-ui;background:#121212;color:white;text-align:center;padding:12vh 24px"><h1>Visita Loja</h1><p>No hay conexión en este momento. Inténtalo nuevamente cuando recuperes internet.</p></body></html>';

// Compatibilidad temporal: elimina únicamente la fila social antigua del bloque de contacto.
// El footer nuevo usa aria-label="Redes sociales oficiales de Visita Loja" y no se modifica.
function cleanLegacySocialRow(html) {
    return html.replace(/\s*<div class="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2" aria-label="Redes sociales de Visita Loja">[\s\S]*?<\/div>(?=\s*<\/div>)/i, '');
}

async function cleanNavigationResponse(response) {
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !type.includes('text/html')) return response;
    const html = cleanLegacySocialRow(await response.text());
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.allSettled(LOCAL_SHELL.map(path => cache.add(path)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (request.mode === 'navigate') {
        const isHome = url.pathname === '/' || url.pathname.endsWith('/index.html');
        event.respondWith(fetch(request).then(async response => {
            const cleaned = isHome ? await cleanNavigationResponse(response) : response;
            if (isHome && cleaned.ok) caches.open(CACHE_NAME).then(cache => cache.put('./index.html', cleaned.clone()));
            return cleaned;
        }).catch(async () => {
            if (isHome) return (await caches.match('./index.html')) || (await caches.match('./')) || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            return new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }));
        return;
    }
    event.respondWith(caches.match(request).then(cached => {
        const network = fetch(request).then(response => {
            if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            return response;
        }).catch(() => cached);
        return cached || network;
    }));
});
