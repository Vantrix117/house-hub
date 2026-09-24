// Phase 2 / PWA — skeptic #1 for finding "first-visit-hub-updated":
//   "A brand-new install often shows 'Hub updated — it will use the new version next time it opens.'"
// Independent re-run with instrumentation. For every fresh context (a brand-new install: no registration, empty caches)
// it records, from an init script that runs before index.html's own code:
//   - whether a controller existed at load (would mean the context was NOT fresh),
//   - updatefound, every statechange of the installing worker as the page's own handler sees it
//     (event order, w.state at dispatch, whether navigator.serviceWorker.controller was already set),
//   - controllerchange, and every toast text the shell showed (#hub-toast).
// Variants: WebKit signed-in (as the investigator), WebKit real clock, WebKit unpaired (the true first screen a new
//   device sees: pairing), WebKit iphone-safari (not standalone), Chromium signed-in.
//   node "audits/tools/phase2/PWA/verify-first-visit-hub-updated-1.mjs" [--runs N]
// Evidence: audits/evidence/p2/PWA/verify-first-visit-hub-updated-1.json (+ one PNG of a run that showed the toast).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const RUNS = (() => { const i = process.argv.indexOf('--runs'); return i > 0 ? +process.argv[i + 1] : 6; })();
const TOAST = 'Hub updated — it will use the new version next time it opens.';

const spy = () => {
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  const ev = window.__swlog = [];
  window.__toasts = [];
  window.__ctrlAtLoad = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  if (!('serviceWorker' in navigator)) { ev.push('no serviceWorker'); return; }
  navigator.serviceWorker.addEventListener('controllerchange', () => ev.push(`${ms()} controllerchange`));
  const reg0 = ServiceWorkerContainer.prototype.register;
  ServiceWorkerContainer.prototype.register = function (...a) {
    ev.push(`${ms()} register()`);
    return reg0.apply(this, a).then(reg => {
      ev.push(`${ms()} registered; installing=${!!reg.installing} waiting=${!!reg.waiting} active=${!!reg.active} controller=${!!navigator.serviceWorker.controller}`);
      const watch = (w, tag) => w && w.addEventListener('statechange', e => ev.push(`${ms()} statechange(${tag}) w.state=${w.state} controller=${!!navigator.serviceWorker.controller}`));
      watch(reg.installing, 'installing-at-register');
      reg.addEventListener('updatefound', () => { ev.push(`${ms()} updatefound`); watch(reg.installing, 'updatefound'); });
      return reg;
    });
  };
  const seen = new Set();
  new MutationObserver(() => { const t = document.getElementById('hub-toast'); if (t && !t.hidden && t.textContent && !seen.has(t.textContent)) { seen.add(t.textContent); window.__toasts.push(t.textContent); ev.push(`${ms()} TOAST: ${t.textContent}`); } })
    .observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
};

const waitFor = async (page, fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await page.evaluate(fn)) return true; } catch {} await sleep(200); } return false; };

async function variant(L, label, opts, runs) {
  const out = [];
  for (let i = 0; i < runs; i++) {
    const d = await L.device({ sw: true, ...opts });
    await d.ctx.addInitScript(spy);
    await d.goto('#home');
    const controlled = await waitFor(d.page, () => !!navigator.serviceWorker.controller);
    await sleep(2000);
    const r = await d.page.evaluate(() => ({ ctrlAtLoad: window.__ctrlAtLoad, toasts: window.__toasts, log: window.__swlog, screen: !document.getElementById('shell') || document.getElementById('shell').hidden ? 'not shell (pairing/picker)' : 'shell' }));
    r.controlledAfter = controlled; r.hubUpdatedToast = r.toasts.includes(TOAST);
    if (r.hubUpdatedToast && !fs.existsSync(path.join(OUT, 'verify-first-visit-hub-updated-1-toast.png'))) {
      await d.page.screenshot({ path: path.join(OUT, 'verify-first-visit-hub-updated-1-toast.png'), scale: 'css' });
      r.shot = 'audits/evidence/p2/PWA/verify-first-visit-hub-updated-1-toast.png';
    }
    out.push(r);
    console.log(`[${label} #${i + 1}] toast=${r.hubUpdatedToast} ctrlAtLoad=${r.ctrlAtLoad} screen=${r.screen}\n   ` + r.log.join('\n   '));
    await d.close();
  }
  return { label, opts, runs: out.length, withToast: out.filter(r => r.hubUpdatedToast).length, results: out };
}

const all = [];
try { fs.unlinkSync(path.join(OUT, 'verify-first-visit-hub-updated-1-toast.png')); } catch {}
{
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  try {
    all.push(await variant(L, 'webkit iphone-pwa signed-in (demo fixed clock)', { device: 'iphone-pwa', profile: 'eli' }, RUNS));
    all.push(await variant(L, 'webkit iphone-pwa signed-in (real clock)', { device: 'iphone-pwa', profile: 'eli', fixedTime: false }, RUNS));
    all.push(await variant(L, 'webkit iphone-pwa unpaired (pairing screen, real clock)', { device: 'iphone-pwa', profile: 'unpaired', fixedTime: false }, RUNS));
    all.push(await variant(L, 'webkit iphone-safari signed-in (real clock)', { device: 'iphone-safari', profile: 'eli', fixedTime: false }, RUNS));
  } finally { await L.close(); }
}
{
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  try {
    all.push(await variant(L, 'chromium iphone-pwa signed-in (real clock)', { device: 'iphone-pwa', profile: 'eli', fixedTime: false }, Math.min(RUNS, 4)));
  } finally { await L.close(); }
}
console.log('\n== SUMMARY');
for (const v of all) console.log(`${v.label}: ${v.withToast}/${v.runs} fresh installs showed "${TOAST}"`);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'verify-first-visit-hub-updated-1.json'), JSON.stringify(all, null, 1));
console.log('wrote audits/evidence/p2/PWA/verify-first-visit-hub-updated-1.json');
