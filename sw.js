const CACHE_NAME = 'stock-casas-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './src/app.js',
    './src/services/auth.service.js',
    './src/services/api.service.js',
    './src/state/store.js'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
    // Peticiones a Google Apps Script siempre directas a la red
    if (e.request.url.includes('script.google.com')) {
        e.respondWith(fetch(e.request));
        return;
    }
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});