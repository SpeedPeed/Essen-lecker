// Piatto Service Worker: App & Preise zuerst aus dem Netz (frische Deploys), offline aus dem Cache.
// Rezeptfotos ändern sich praktisch nie: zuerst aus dem Cache (schnell, offline), sonst laden und merken.
const CACHE = 'piatto-v2';
const SHELL = ['./', 'index.html', 'styles.css', 'data.js', 'planner.js', 'app.js', 'prices.json', 'img/credits.json', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
const keep = (req, r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; };
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Schriften, Bring! usw. nicht anfassen
  if (/\/img\/[^/]+\.jpg$/.test(u.pathname)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => keep(e.request, r))));
    return;
  }
  e.respondWith(fetch(e.request).then(r => keep(e.request, r))
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
