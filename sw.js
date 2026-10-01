/* House Hub service worker.
   - Precaches the shell, design system, SDK, apps and icons so the hub opens offline.
   - apps.json and anything under /api are network-first (fresh when online, cached copy when not).
   - Precached files are served from cache and refreshed in the background (stale-while-revalidate),
     so an edit shows up on the second open. Bump VERSION to force a clean cache.
   - Every fetch the worker makes for itself skips the browser's HTTP cache (P2-PWA-09): GitHub Pages sends max-age=600,
     so a VERSION bump would otherwise precache the files the device fetched before the deploy.
   - A document it has no copy of, offline, gets offline.html (P2-PWA-16) instead of a bare "Offline".
   - push: shows the notification the Worker sent; notificationclick deep-links into the app via the URL hash and says
     whose it was (a shared device). pushsubscriptionchange hands the house the browser's new subscription (PWA-GAP-2). */
const VERSION = 'hub-v44';
const SHELL = [
  './', 'index.html', 'manifest.json', 'icon.svg', 'sw.js', 'offline.html',
  'apps/design.css', 'apps/hub.js',
  'apps/f260.html', 'apps/leftovers.html', 'apps/prayer.html', 'apps/tally.html', 'apps/timer.html', 'apps/kidverse.html', 'apps/verses.html',
  'icons/f260.svg', 'icons/leftovers.svg', 'icons/prayer.svg', 'icons/tally.svg', 'icons/timer.svg',
  'icons/dollywood.svg', 'icons/dollywood-live.svg', 'icons/kidverse.svg', 'icons/verses.svg', 'icons/sprite.svg',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png', 'icons/icon-monochrome.png', 'icons/badge-96.png',
  // the park map must work in the park: the page + the layers it opens with (the aerial photo is cached on first use)
  'apps/dollywood-live.html', 'apps/dollywood/relief.jpg', 'apps/dollywood/slope.png', 'apps/dollywood/relief_soft.jpg', 'apps/dollywood/illustrated_lo.jpg',
  // the illustration set (art/README.md) — small SVGs, all of them
  'art/ambient/dawn.svg', 'art/ambient/day.svg', 'art/ambient/dusk.svg', 'art/ambient/night.svg', 'art/app/chat.svg', 'art/app/dollywood-live.svg', 'art/app/dollywood.svg', 'art/app/f260.svg', 'art/app/kidverse.svg', 'art/app/verses.svg', 'art/app/feed.svg', 'art/app/leftovers.svg', 'art/app/prayer.svg', 'art/app/reminders.svg', 'art/app/tally.svg', 'art/app/timer.svg', 'art/empty/chat.svg', 'art/empty/feed.svg', 'art/empty/fridge.svg', 'art/empty/list.svg', 'art/empty/prayers.svg', 'art/hero/afternoon.svg', 'art/hero/evening.svg', 'art/hero/morning.svg', 'art/hero/night.svg', 'art/hero/play.svg', 'art/story/01-creation.svg', 'art/story/02-flood.svg', 'art/story/03-promise.svg', 'art/story/04-exodus.svg', 'art/story/05-law.svg', 'art/story/06-kings.svg', 'art/story/07-prophets.svg', 'art/story/08-exile.svg', 'art/story/09-nativity.svg', 'art/story/10-teaching.svg', 'art/story/11-cross.svg', 'art/story/12-church.svg',
];

const CONFIG = 'hub-config';   // where the house is (and its push key), kept across versions for pushsubscriptionchange
// cache: 'reload' — straight from the server, never a copy the browser's HTTP cache kept from before the deploy
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== CONFIG).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('apps.json', copy)); return r; })
      .catch(() => caches.match('apps.json')));
    return;
  }
  // Ignore cache-busting query strings (?ts=, ?r=) when looking up the shell.
  const key = url.pathname.endsWith('/') ? './' : url.pathname.replace(/^.*\/house-hub\//, '').replace(/^\//, '');
  const isDoc = req.mode === 'navigate' || req.destination === 'document' || req.destination === 'iframe';
  e.respondWith(caches.open(VERSION).then(async c => {
    const cached = await c.match(key) || await c.match(req, { ignoreSearch: true });
    // revalidate with the server (no-cache: a conditional request, never the HTTP cache's copy)
    const network = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    return cached || (await network) || (isDoc ? offlinePage(c) : new Response('Offline', { status: 503 }));
  }));
});
// The styled "not saved on this device yet" page, with a <base> so its stylesheet loads from the cache wherever it stands in.
async function offlinePage(c) {
  const page = await c.match('offline.html');
  if (!page) return new Response('Offline', { status: 503 });
  const html = (await page.text()).replace('<head>', `<head><base href="${self.registration.scope}">`);
  return new Response(html, { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// The page tells the worker where the house is (and the push key once notifications are on), for pushsubscriptionchange.
self.addEventListener('message', e => {
  const d = e.data;
  if (!d || d.source !== 'hubshell' || d.type !== 'config') return;
  e.waitUntil((async () => {
    const c = await caches.open(CONFIG);
    const old = await c.match('config').then(r => (r ? r.json() : {})).catch(() => ({}));
    const next = { ...old, ...(typeof d.api === 'string' ? { api: d.api } : {}), ...(typeof d.publicKey === 'string' ? { publicKey: d.publicKey } : {}),
      ...('deviceToken' in d ? { deviceToken: typeof d.deviceToken === 'string' ? d.deviceToken : null } : {}) };   // the page keeps it in localStorage: the same origin
    await c.put('config', new Response(JSON.stringify(next), { headers: { 'Content-Type': 'application/json' } }));
  })());
});

// ── push notifications ────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'Anderson House';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png',
    tag: data.tag || 'hub', renotify: !!data.tag, data: { url: data.url || '#home', to: data.to || null },
  }));
});
// The hub's own window: a top-level client (never an app's frame inside it, which would swallow the message), the focused
// or visible one first (review of batch 2b).
self.pickClient = list => {
  const tops = list.filter(c => c.frameType === 'top-level' && c.url.startsWith(self.registration.scope));
  return tops.find(c => c.focused) || tops.find(c => c.visibilityState === 'visible') || tops[0] || null;
};
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {};
  const target = new URL('index.html' + (d.url || '#home'), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = self.pickClient(list);
    if (open) { open.postMessage({ source: 'hubsw', type: 'open', url: target, to: d.to || null }); return open.focus(); }
    // a new window says whose notification it was (?to=): the shell opens nothing of theirs for someone else
    return self.clients.openWindow(new URL('index.html' + (d.to ? '?to=' + encodeURIComponent(d.to) : '') + (d.url || '#home'), self.registration.scope).href);
  }));
});
// PWA-GAP-2: the push service replaced this device's subscription. Subscribe again with the same key if the browser did not,
// and tell the house (by the old endpoint, with this device's token), then any open hub re-checks Me → Notifications.
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    const cfg = await caches.open(CONFIG).then(c => c.match('config')).then(r => (r ? r.json() : {})).catch(() => ({}));
    const old = e.oldSubscription || null;
    let sub = e.newSubscription || null;
    if (!sub) {
      const b64 = s => Uint8Array.from(atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
      const key = (old && old.options && old.options.applicationServerKey) || (cfg.publicKey ? b64(cfg.publicKey) : null);
      if (key) sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).catch(() => null);
    }
    // the house moves only this device's rows, so the request carries this device's token (review of batch 2b)
    if (sub && old && old.endpoint && cfg.api && cfg.deviceToken) {
      await fetch(cfg.api.replace(/\/$/, '') + '/api/push/resubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-Token': cfg.deviceToken }, body: JSON.stringify({ old_endpoint: old.endpoint, subscription: sub.toJSON() }) }).catch(() => {});
    }
    for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage({ source: 'hubsw', type: 'pushsub' });
  })());
});
