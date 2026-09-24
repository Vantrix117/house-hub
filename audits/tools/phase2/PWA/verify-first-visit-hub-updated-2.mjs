// Phase 2 / PWA — skeptic #2 for finding "first-visit-hub-updated" (index.html:1695 shows "Hub updated" on a brand-new install).
//   node "audits/tools/phase2/PWA/verify-first-visit-hub-updated-2.mjs" [runs]      (default 8 runs per variant)
// Independent of sw.mjs. Each run is a brand-new browser context (empty SW registrations + caches) on the local instance.
// Variants:
//   A  harness device (paired, Eli signed in, #home), real browser clock (fixedTime:false), WebKit
//   B  bare context from the same browser: NO Playwright route, NO clock, only hub.api -> local set before any script;
//      unpaired, i.e. exactly what a new phone sees first (the pairing screen). Rules out the harness's route/clock.
//   C  = A on Chromium (the installed Chrome), for comparison.
// Every run traces, in page order: updatefound, each statechange of the installing worker with the value of
// navigator.serviceWorker.controller at that moment, controllerchange, and every toast the page shows.
// Evidence: audits/evidence/p2/PWA/verify-first-visit-hub-updated-2.json
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const RUNS = Number(process.argv[2]) || 8;

// Page-side trace. Wraps register() only to attach listeners first; the app's own listeners run right after ours in the
// same dispatch, so `ctl` below is exactly what index.html:1695 sees.
const tracer = () => {
  window.__trace = []; window.__toasts = [];
  const t0 = performance.now(); const T = () => Math.round(performance.now() - t0);
  const push = (ev, extra = {}) => window.__trace.push({ t: T(), ev, ctl: !!(navigator.serviceWorker && navigator.serviceWorker.controller), ...extra });
  if ('serviceWorker' in navigator) {
    push('boot');
    navigator.serviceWorker.addEventListener('controllerchange', () => push('controllerchange'));
    const reg0 = ServiceWorkerContainer.prototype.register;
    ServiceWorkerContainer.prototype.register = function (...a) {
      const p = reg0.apply(this, a);
      p.then(reg => {
        push('registered', { installing: !!reg.installing, active: !!reg.active });
        reg.addEventListener('updatefound', () => {
          const w = reg.installing; push('updatefound', { state: w && w.state });
          if (w) w.addEventListener('statechange', () => push('statechange', { state: w.state }));
        });
      }, () => {});
      return p;
    };
  }
  const seen = new Set();
  new MutationObserver(() => { const el = document.getElementById('hub-toast'); if (el && el.textContent && !seen.has(el.textContent)) { seen.add(el.textContent); window.__toasts.push({ t: T(), text: el.textContent }); } })
    .observe(document, { subtree: true, childList: true, characterData: true });
};

const settle = async page => { const end = Date.now() + 12000; while (Date.now() < end) { const done = await page.evaluate(() => (window.__trace || []).some(e => e.ev === 'statechange' && e.state === 'activated')).catch(() => false); if (done) break; await sleep(150); } await sleep(1500); };
const summarize = r => ({ toast: r.toasts.some(x => /Hub updated/.test(x.text)), installedWithController: r.trace.some(e => e.ev === 'statechange' && e.state === 'installed' && e.ctl) });

async function harnessRuns(engine) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  const out = [];
  try {
    for (let i = 0; i < RUNS; i++) {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', sw: true, fixedTime: false });
      await d.ctx.addInitScript(tracer);
      await d.goto('#home');
      await settle(d.page);
      const r = await d.page.evaluate(() => ({ trace: window.__trace, toasts: window.__toasts, title: document.title }));
      out.push({ ...summarize(r), ...r });
      await d.close();
    }
  } finally { await L.close(); }
  return out;
}

async function bareRuns() {
  // A context with no route and no clock: just the site, as a brand-new phone would open it (pairing screen).
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  const out = [];
  try {
    for (let i = 0; i < RUNS; i++) {
      const ctx = await L.browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 }, timezoneId: 'America/New_York', locale: 'en-US' });
      // keep every API call on the local instance (hub.js DEFAULT_API is production); this runs before any page script
      await ctx.addInitScript(api => { try { if (!localStorage.getItem('hub.api')) localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, L.api);
      await ctx.addInitScript(tracer);
      const hosts = new Set();
      ctx.on('request', rq => { try { hosts.add(new URL(rq.url()).host); } catch {} });
      const page = await ctx.newPage();
      await page.goto(L.site + '/index.html', { waitUntil: 'load' });
      await settle(page);
      const r = await page.evaluate(() => ({ trace: window.__trace, toasts: window.__toasts, pairing: !!document.querySelector('input[type=password], input[inputmode], #pair, [id*=pair]') }));
      out.push({ ...summarize(r), ...r, hosts: [...hosts] });
      if (i === 0 || (summarize(r).toast && !out.slice(0, -1).some(x => x.toast))) {
        await page.screenshot({ path: path.join(OUT, `verify-first-visit-hub-updated-2-bare-${i}-iphone-light.png`) });
      }
      await ctx.close();
    }
  } finally { await L.close(); }
  return out;
}

const res = {};
res.A_webkit_harness = await harnessRuns('webkit');
res.B_webkit_bare = await bareRuns();
res.C_chromium_harness = await harnessRuns('chromium');

const tally = {};
for (const [k, runs] of Object.entries(res)) tally[k] = { runs: runs.length, toast: runs.filter(r => r.toast).length, installedWithController: runs.filter(r => r.installedWithController).length };
console.log('TALLY', JSON.stringify(tally, null, 1));
for (const [k, runs] of Object.entries(res)) {
  console.log('\n== ' + k);
  runs.forEach((r, i) => console.log(`run ${i}: toast=${r.toast} | ` + r.trace.map(e => `${e.t}ms ${e.ev}${e.state ? ':' + e.state : ''}${e.ctl ? '(ctl)' : ''}`).join(' -> ') + (r.hosts ? ' | hosts=' + r.hosts.join(',') : '')));
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'verify-first-visit-hub-updated-2.json'), JSON.stringify({ tally, res }, null, 1));
console.log('\nwrote audits/evidence/p2/PWA/verify-first-visit-hub-updated-2.json');
