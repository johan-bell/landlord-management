/* Minimal offline shell — network-first for navigations. */
self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    if (event.request.mode !== 'navigate') return;
    event.respondWith(
        fetch(event.request).catch(
            () =>
                new Response(
                    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body style="font-family:system-ui;padding:2rem"><p>You are offline. Check your connection and try again.</p></body></html>',
                    {
                        status: 503,
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    },
                ),
        ),
    );
});
