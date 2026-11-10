// Offline cache for the Pointie web app shell.
const CACHE = 'pointie-v50';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/dom.js', 'js/catalog.js', 'js/store.js', 'js/remote.js', 'js/config.js', 'js/vendor/supabase.js', 'js/data.js', 'js/geo.js', 'js/ui.js', 'js/icons.js',
  'js/screens-onboard.js', 'js/screens-join.js', 'js/native.js', 'js/screens-me.js', 'js/i18n.js', 'js/screens-main.js', 'js/screens-flow.js',
  'img/app-icon.png', 'img/icon-192.png', 'img/apple-touch-icon.png', 'img/logo-dpoint.png', 'img/logo-dpoint-white.png', 'img/pointie-cheer.png', 'img/pointie-jump.png',
  'img/pointie-point.png', 'img/pointie-wink.png', 'img/pointie-wow.png', 'img/pointie-face.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates land), falling back to cache when offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
