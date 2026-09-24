// Phase 2 / PWA — skeptic #1 for "first-visit-hub-updated", part 2: is the toast an artefact of the rig's instant install?
// On localhost the service worker precaches 70 files in ~60 ms, so install finishes while the shell is still booting
// (main thread busy). Over the network (GitHub Pages, several MB of park-map images) install takes seconds and the page
// is usually idle by then. Playwright WebKit does not route service-worker fetches (checked: a context route saw 0 of
// them), so this script puts a tiny delaying proxy of its own in front of the rig's site (http://localhost:<port>, so the
// shell still registers its worker) and opens the TRUE first screen of a new device there: unpaired → pairing.
// Only precache-only files (art/story/*, apps/dollywood/*) are delayed, so the page itself loads at full speed.
//   D0  the rig's own site, no proxy, unpaired      (control: what sw.mjs s1 measures, on the pairing screen)
//   P0  proxy, no delay                              (control: the proxy alone)
//   P1  precache-only files 3 s late, page idle      (16 delayed files, ~6 at a time: install ends ~9 s after load; 2×N runs)
//   P2  as P1, page kept busy (40 ms long task every 50 ms from 1.5 s to 14.5 s) — a busy phone when install lands
//   node "audits/tools/phase2/PWA/verify-first-visit-hub-updated-1-slow.mjs" [--runs N]
// Evidence: audits/evidence/p2/PWA/verify-first-visit-hub-updated-1-slow.json
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const RUNS = (() => { const i = process.argv.indexOf("--runs"); return i > 0 ? +process.argv[i + 1] : 6; })();
const TOAST = 'Hub updated — it will use the new version next time it opens.';

let DELAY = 0, delayed = 0;
async function proxy(target) {
  const port = await new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  const handler = async (req, res) => {
    const u = new URL(req.url, target);
    if (DELAY && /^\/(art\/story|apps\/dollywood)\//.test(u.pathname)) { delayed++; await sleep(DELAY); }
    try {
      const r = await fetch(u, { headers: { accept: req.headers.accept || '*/*' } });
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(buf);
    } catch (e) { res.writeHead(502); res.end(); }
  };
  const s4 = http.createServer(handler), s6 = http.createServer(handler);
  await new Promise(ok => s4.listen(port, '127.0.0.1', ok));
  await new Promise(ok => s6.once('error', () => ok()).listen(port, '::1', ok));
  return { origin: `http://localhost:${port}`, close: () => { s4.close(); s6.close(); } };
}

const spy = ({ busy, api }) => {
  try { if (!localStorage.getItem('hub.api')) localStorage.setItem('hub.api', JSON.stringify(api)); } catch {}   // never the production API
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  const ev = window.__swlog = [];
  window.__toasts = [];
  if (busy) setTimeout(() => { const iv = setInterval(() => { const e = performance.now() + 40; while (performance.now() < e); }, 50); setTimeout(() => clearInterval(iv), 13000); }, 1500);
  navigator.serviceWorker.addEventListener('controllerchange', () => ev.push(`${ms()} controllerchange`));
  const reg0 = ServiceWorkerContainer.prototype.register;
  ServiceWorkerContainer.prototype.register = function (...a) {
    ev.push(`${ms()} register()`);
    return reg0.apply(this, a).then(reg => {
      const watch = w => w && w.addEventListener('statechange', () => ev.push(`${ms()} statechange w.state=${w.state} controller=${!!navigator.serviceWorker.controller}`));
      watch(reg.installing);
      reg.addEventListener('updatefound', () => ev.push(`${ms()} updatefound`));
      return reg;
    });
  };
  const seen = new Set();
  new MutationObserver(() => { const t = document.getElementById('hub-toast'); if (t && !t.hidden && t.textContent && !seen.has(t.textContent)) { seen.add(t.textContent); window.__toasts.push(t.textContent); ev.push(`${ms()} TOAST: ${t.textContent}`); } })
    .observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
};
const waitFor = async (page, fn, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await page.evaluate(fn)) return true; } catch {} await sleep(200); } return false; };

async function run(L, P, label, { delay = 0, busy = false, runs = RUNS, direct = false }) {
  const out = [];
  DELAY = delay;
  for (let i = 0; i < runs; i++) {
    delayed = 0;
    const d = await L.device({ device: 'iphone-pwa', profile: 'unpaired', sw: true, fixedTime: false });
    await d.ctx.addInitScript(spy, { busy, api: L.api });
    await d.page.goto((direct ? L.site : P.origin) + '/index.html', { waitUntil: 'load' });
    const controlled = await waitFor(d.page, () => !!navigator.serviceWorker.controller);
    await sleep(1500);
    const r = await d.page.evaluate(async () => { const keys = await caches.keys(); let entries = 0; for (const k of keys) entries += (await (await caches.open(k)).keys()).length; return { toasts: window.__toasts, log: window.__swlog, cacheEntries: entries, pairingVisible: !!document.querySelector('#pairing:not([hidden]), .pairing, [data-screen="pair"]') }; });
    r.controlled = controlled; r.delayedRequests = delayed; r.hubUpdatedToast = r.toasts.includes(TOAST);
    const u = r.log.find(l => l.includes('updatefound')), inst = r.log.find(l => l.includes('w.state=installed'));
    r.installMs = u && inst ? parseInt(inst) - parseInt(u) : null;
    out.push(r);
    console.log(`[${label} #${i + 1}] toast=${r.hubUpdatedToast} installMs=${r.installMs} delayedRequests=${delayed} cacheEntries=${r.cacheEntries}\n   ` + r.log.join('\n   '));
    await d.close();
  }
  return { label, delay, busy, runs: out.length, withToast: out.filter(r => r.hubUpdatedToast).length, results: out };
}

const all = [];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const P = await proxy(L.site);
try {
  all.push(await run(L, P, 'D0 webkit unpaired, rig site direct (no proxy), no delay', { direct: true }));
  all.push(await run(L, P, 'P0 webkit unpaired via proxy, no delay', {}));
  all.push(await run(L, P, 'P1 webkit unpaired, precache 3 s late, page idle', { delay: 3000, runs: RUNS * 2 }));
  all.push(await run(L, P, 'P2 webkit unpaired, precache 3 s late, page busy', { delay: 3000, busy: true }));
} finally { P.close(); await L.close(); }
console.log('\n== SUMMARY');
for (const v of all) console.log(`${v.label}: ${v.withToast}/${v.runs} showed the toast; installMs=${v.results.map(r => r.installMs).join(',')}; cacheEntries=${v.results.map(r => r.cacheEntries).join(',')}`);
fs.writeFileSync(path.join(OUT, 'verify-first-visit-hub-updated-1-slow.json'), JSON.stringify(all, null, 1));
console.log('wrote audits/evidence/p2/PWA/verify-first-visit-hub-updated-1-slow.json');
