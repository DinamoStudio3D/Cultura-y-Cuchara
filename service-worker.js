const CACHE_NAME = 'cultura-cuchara-shell-v1';
const LOCAL_SHELL = ['./', './index.html', './manifest.webmanifest', './mascota-vive-loja.png'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => Promise.allSettled(LOCAL_SHELL.map(path => cache.add(path))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put('./index.html', response.clone()));
                    return response;
                })
                .catch(async () => (await caches.match('./index.html')) || (await caches.match('./')) || new Response(
                    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sin conexión</title><body style="font-family:system-ui;background:#121212;color:white;text-align:center;padding:12vh 24px"><h1>Vive Loja</h1><p>No hay conexión en este momento. Inténtalo nuevamente cuando recuperes internet.</p></body></html>',
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                ))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cached => {
            const network = fetch(request).then(response => {
                if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
                return response;
            }).catch(() => cached);
            return cached || network;
        })
    );
});
