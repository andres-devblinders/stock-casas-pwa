const CACHE_NAME = 'stock-casas-v3';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './src/app.js',
    './src/services/auth.service.js',
    './src/services/api.service.js',
    './src/state/store.js'
];

// Activar inmediatamente sin esperar a que se cierren pestañas
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())  // <-- activa sin esperar
    );
});

// Tomar control de todas las pestañas abiertas al instante
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))  // borrar cachés viejos
            )
        ).then(() => self.clients.claim())  // <-- controla tabs existentes
    );
});

self.addEventListener('fetch', e => {
    const url = e.request.url;

    // API de Google Apps Script: siempre directo a red (sin caché)
    if (url.includes('script.google.com')) {
        e.respondWith(fetch(e.request));
        return;
    }

    // Archivos JS/HTML: network-first → si hay red, descarga fresco;
    // si no hay red, sirve del caché (modo offline).
    if (url.endsWith('.js') || url.endsWith('.html') || url.includes('app.js')) {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Resto de assets: cache-first
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});