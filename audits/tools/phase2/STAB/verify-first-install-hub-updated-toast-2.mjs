// STAB skeptic #2 — "A brand-new install says 'Hub updated'" (index.html:1692-1696, sw.js:22-26).
//   node "audits/tools/phase2/STAB/verify-first-install-hub-updated-toast-2.mjs" [runs=3]
// For each engine (webkit, chromium) and each first-visit state ('unpaired' = the real first install: the pairing gate;
// 'eli' = a signed-in context whose first load of this origin registers the worker), a fresh context with service
// workers allowed loads the shell once. An init script wraps ServiceWorkerContainer.register and logs, with timestamps,
// updatefound, every statechange of the installing worker (with w.state and whether navigator.serviceWorker.controller is
// already set at that moment), controllerchange, and every hub.toast call. Then the page is reloaded once (the second
// open) to show whether the toast repeats. The first WebKit 'unpaired' run is screenshotted at 1x while the toast is up.
// Output: audits/evidence/p2/STAB/verify-first-install-2.json (+ verify-first-install-2-webkit-unpaired.png)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const RUNS = +(process.argv[2] || 3);
const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
fs.mkdirSync(OUT, { recursive: true });

const INIT = () => {
  if (window !== window.top) return;
  const t0 = performance.now();
  const ev = window.__ev = [];
  const ctl = () => !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  const log = (what, extra = {}) => ev.push({ t: Math.round(performance.now() - t0), what, controller: ctl(), ...extra });
  window.__toastCalls = [];
  const iv = setInterval(() => {
    if (window.hub && hub.toast && !hub.toast.__w) { const t = hub.toast; hub.toast = (m, ms) => { window.__toastCalls.push(m); log('toast', { msg: m }); return t(m, ms); }; hub.toast.__w = 1; clearInterval(iv); }
  }, 2);
  if (!navigator.serviceWorker) return;
  log('boot');
  navigator.serviceWorker.addEventListener('controllerchange', () => log('controllerchange'));
  const orig = ServiceWorkerContainer.prototype.register;
  ServiceWorkerContainer.prototype.register = function (...a) {
    log('register-called');
    const p = orig.apply(this, a);
    p.then(reg => {
      log('register-resolved', { installing: reg.installing && reg.installing.state, waiting: !!reg.waiting, active: reg.active && reg.active.state });
      reg.addEventListener('updatefound', () => {
        const w = reg.installing; log('updatefound', { state: w && w.state });
        if (w) w.addEventListener('statechange', () => log('statechange', { state: w.state }));
      });
    }, e => log('register-rejected', { err: String(e) }));
    return p;
  };
};

const R = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  R[engine] = {};
  try {
    for (const profile of ['unpaired', 'eli']) {
      R[engine][profile] = [];
      for (let i = 0; i < RUNS; i++) {
        const d = await L.device({ device: 'iphone-pwa', profile, sw: true, fixedTime: false });
        await d.ctx.addInitScript(INIT);
        await d.goto(profile === 'eli' ? '#home' : '');
        // wait for the worker to finish (controller set) or 8 s
        const until = Date.now() + 8000;
        let shot = null;
        while (Date.now() < until) {
          const s = await d.page.evaluate(() => ({ c: !!navigator.serviceWorker.controller, n: window.__toastCalls.length }));
          if (s.n && engine === 'webkit' && profile === 'unpaired' && i === 0 && !shot) {
            shot = path.join(OUT, 'verify-first-install-2-webkit-unpaired.png');
            await d.page.screenshot({ path: shot, scale: 'css', animations: 'disabled', caret: 'hide' });
          }
          if (s.c) break;
          await sleep(50);
        }
        await sleep(1500);
        const first = await d.page.evaluate(() => ({ ev: window.__ev, toastCalls: window.__toastCalls, toastText: (document.getElementById('hub-toast') || {}).textContent || null }));
        // the second open of the same install
        await d.page.reload({ waitUntil: 'load' });
        await sleep(2500);
        const second = await d.page.evaluate(() => ({ controllerAtEnd: !!navigator.serviceWorker.controller, toastCalls: window.__toastCalls, ev: window.__ev.map(e => e.what) }));
        const installed = first.ev.find(e => e.what === 'statechange' && e.state === 'installed');
        const cc = first.ev.find(e => e.what === 'controllerchange');
        const row = {
          run: i + 1,
          firstLoadToast: first.toastCalls,
          installedStatechange: installed || null,
          controllerchangeAt: cc ? cc.t : null,
          controllerchangeBeforeInstalledEvent: !!(cc && installed && first.ev.indexOf(cc) < first.ev.indexOf(installed)),
          secondLoadToast: second.toastCalls,
          events: first.ev.map(e => `${e.t}ms ${e.what}${e.state ? ':' + e.state : ''}${e.installing ? ' installing=' + e.installing : ''} ctl=${e.controller}`),
          screenshot: shot,
        };
        R[engine][profile].push(row);
        console.log(engine, profile, i + 1, 'toast:', JSON.stringify(first.toastCalls), '| installed-statechange sees controller:', installed && installed.controller, '| controllerchange before installed event:', row.controllerchangeBeforeInstalledEvent, '| 2nd load toast:', JSON.stringify(second.toastCalls));
        console.log('   ', row.events.join(' | '));
        await d.close();
      }
    }
  } finally { await L.close(); }
}
const sum = {};
for (const [e, byP] of Object.entries(R)) for (const [p, rows] of Object.entries(byP)) sum[`${e}/${p}`] = `${rows.filter(r => r.firstLoadToast.length).length}/${rows.length} first loads toasted; ${rows.filter(r => r.secondLoadToast.length).length}/${rows.length} second loads toasted`;
console.log(JSON.stringify(sum, null, 1));
fs.writeFileSync(path.join(OUT, 'verify-first-install-2.json'), JSON.stringify({ summary: sum, runs: R }, null, 1));
