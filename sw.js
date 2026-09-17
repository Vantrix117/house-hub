/* House Hub service worker.
   - Precaches the shell, design system, SDK, apps and icons so the hub opens offline.
   - apps.json and anything under /api are network-first (fresh when online, cached copy when not).
   - Precached files are served from cache and refreshed in the background (stale-while-revalidate),
     so an edit shows up on the second open. Bump VERSION to force a clean cache.
   - push: shows the notification the Worker sent; notificationclick deep-links into the app via the URL hash. */
const VERSION = 'hub-v9';
const SHELL = [
  './', 'index.html', 'manifest.json', 'icon.svg', 'sw.js',
  'apps/design.css', 'apps/hub.js',
  'apps/f260.html', 'apps/leftovers.html', 'apps/prayer.html', 'apps/tally.html', 'apps/timer.html',
  'icons/f260.svg', 'icons/leftovers.svg', 'icons/prayer.svg', 'icons/tally.svg', 'icons/timer.svg',
  'icons/reminders.svg', 'icons/chat.svg', 'icons/home.svg', 'icons/dollywood.svg', 'icons/dollywood-live.svg',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png',
  // the park map must work in the park: the page + the layers it opens with (the aerial photo is cached on first use)
  'apps/dollywood-live.html', 'apps/dollywood/relief.jpg', 'apps/dollywood/slope.png',
  // the illustration set (art/README.md) — small SVGs, all of them
  'art/ambient/dawn.svg', 'art/ambient/day.svg', 'art/ambient/dusk.svg', 'art/ambient/night.svg', 'art/app/chat.svg', 'art/app/dollywood-live.svg', 'art/app/dollywood.svg', 'art/app/f260.svg', 'art/app/feed.svg', 'art/app/leftovers.svg', 'art/app/prayer.svg', 'art/app/reminders.svg', 'art/app/tally.svg', 'art/app/timer.svg', 'art/empty/chat.svg', 'art/empty/feed.svg', 'art/empty/fridge.svg', 'art/empty/list.svg', 'art/empty/prayers.svg', 'art/hero/afternoon.svg', 'art/hero/evening.svg', 'art/hero/morning.svg', 'art/hero/night.svg', 'art/hero/play.svg', 'art/story/01-creation.svg', 'art/story/02-flood.svg', 'art/story/03-promise.svg', 'art/story/04-exodus.svg', 'art/story/05-law.svg', 'art/story/06-kings.svg', 'art/story/07-prophets.svg', 'art/story/08-exile.svg', 'art/story/09-nativity.svg', 'art/story/10-teaching.svg', 'art/story/11-cross.svg', 'art/story/12-church.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const isApi = url => /\/api\//.test(url.pathname) || url.hostname.endsWith('.workers.dev');
const isRegistry = url => url.pathname.endsWith('/apps.json');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (isApi(url)) return;   // the SDK handles its own offline queue; never serve API responses from cache
  if (url.origin !== location.origin) return;   // Google Fonts etc.

  if (isRegistry(url)) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('apps.json', copy)); return r; })
      .catch(() => caches.match('apps.json')));
    return;
  }
  // Ignore cache-busting query strings (?ts=, ?r=) when looking up the shell.
  const key = url.pathname.endsWith('/') ? './' : url.pathname.replace(/^.*\/house-hub\//, '').replace(/^\//, '');
  e.respondWith(caches.open(VERSION).then(async c => {
    const cached = await c.match(key) || await c.match(req, { ignoreSearch: true });
    const network = fetch(req).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    return cached || (await network) || new Response('Offline', { status: 503 });
  }));
});

// ── push notifications ────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'Anderson House';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    tag: data.tag || 'hub', renotify: !!data.tag, data: { url: data.url || '#home' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL('index.html' + (e.notification.data && e.notification.data.url || '#home'), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if (open) { open.postMessage({ source: 'hubsw', type: 'open', url: target }); return open.focus(); }
    return self.clients.openWindow(target);
  }));
});
