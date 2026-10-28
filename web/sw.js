// Tend service worker: the app shell works offline; fonts and covers are cached as they load.
const VERSION = 'tend-12df2e10df';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== 'tend-runtime').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // the app page: network first so updates arrive, cache when offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // fonts: cache first
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open('tend-runtime').then(async (c) => (await c.match(req)) || fetch(req).then((r) => { c.put(req, r.clone()); return r; })));
    return;
  }
  // sponsor list and logos: always try the network first so changes show up
  if (url.origin === location.origin && (/sponsors\.json$/.test(url.pathname) || url.pathname.includes('/logos/'))) {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open('tend-runtime').then((c) => c.put(req, copy)); return r; })
      .catch(() => caches.match(req)));
    return;
  }
  // own files: cache, then network
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
