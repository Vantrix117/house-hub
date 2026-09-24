// STAB skeptic #1 for "first-install-hub-updated-toast": does a device's first ever load show "Hub updated"?
//   node "audits/tools/phase2/STAB/verify-first-install-hub-updated-toast-1.mjs" [runs=3]
// For each engine (webkit, chromium) and each case (Eli signed in on the iPad, Eli on the iPhone PWA, an unpaired
// iPhone = the real first-visit screen), in a fresh context with service workers allowed:
//   - proves the load is a first install: no controller and no registration when the document starts, one load only;
//   - hooks navigator.serviceWorker.register BEFORE the shell's own .then, so our updatefound/statechange listeners run
//     first and see exactly the state + controller the shell's listener sees (index.html:1693-1695);
//   - records controllerchange timing, every hub.toast call, and whether #hub-toast is actually visible with the text;
//   - reloads once (same context, same sw.js) as a control: a plain second open must not toast.
// Screenshot (1x css) of the first WebKit iPhone toast: audits/evidence/p2/STAB/verify-first-install-toast-webkit-iphone.png
// Output: audits/evidence/p2/STAB/verify-first-install-hub-updated-toast-1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const RUNS = +(process.argv[2] || 3);
const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
fs.mkdirSync(OUT, { recursive: true });
const CASES = [
  { name: 'ipad-eli', device: 'ipad-portrait', profile: 'eli', ready: '#view-home .card' },
  { name: 'iphone-eli', device: 'iphone-pwa', profile: 'eli', ready: '#view-home .card' },
  { name: 'iphone-unpaired', device: 'iphone-pwa', profile: 'unpaired', ready: 'body' },
];

const INIT = () => {
  if (window !== window.top) return;
  const t0 = performance.now();
  const T = () => Math.round(performance.now() - t0);
  const V = window.__v = { ev: [], toasts: [], toastVisible: null };
  try { const n = +(sessionStorage.getItem('v.loads') || 0) + 1; sessionStorage.setItem('v.loads', n); V.loadNo = n; } catch { V.loadNo = -1; }
  const sw = navigator.serviceWorker;
  if (!sw) { V.noSW = true; return; }
  V.controllerAtStart = !!sw.controller;
  sw.getRegistrations().then(rs => { V.regsAtStart = rs.length; });
  sw.addEventListener('controllerchange', () => V.ev.push({ t: T(), e: 'controllerchange', controller: !!sw.controller }));
  const reg0 = sw.register.bind(sw);
  sw.register = (...a) => {
    V.ev.push({ t: T(), e: 'register()', controller: !!sw.controller });
    const p = reg0(...a);
    p.then(reg => {
      V.ev.push({ t: T(), e: 'registered', controller: !!sw.controller, installing: !!reg.installing, waiting: !!reg.waiting, active: !!reg.active });
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        V.ev.push({ t: T(), e: 'updatefound', controller: !!sw.controller, wState: w && w.state });
        if (w) w.addEventListener('statechange', () => V.ev.push({ t: T(), e: 'statechange', state: w.state, controller: !!sw.controller }));
      });
    });
    return p;
  };
  const iv = setInterval(() => {
    if (window.hub && hub.toast && !hub.toast.__v) {
      const t = hub.toast; hub.toast = (m, ms) => { V.toasts.push({ t: T(), m }); const r = t(m, ms); const el = document.getElementById('hub-toast'); if (el) { const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); V.toastVisible = { hidden: el.hidden, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), text: el.textContent }; } return r; };
      hub.toast.__v = 1; clearInterval(iv);
    }
  }, 2);
};

const R = { runs: RUNS, results: {} };
let shotTaken = false;
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  R.results[engine] = {};
  try {
    for (const c of CASES) {
      R.results[engine][c.name] = [];
      for (let i = 0; i < RUNS; i++) {
        const d = await L.device({ device: c.device, profile: c.profile, sw: true, fixedTime: false });
        await d.ctx.addInitScript(INIT);
        await d.goto('#home');
        await d.page.waitForSelector(c.ready).catch(() => {});
        // screenshot the toast the moment it is on screen (WebKit iPhone, once)
        if (engine === 'webkit' && c.name === 'iphone-eli' && !shotTaken) {
          const ok = await d.page.waitForFunction(() => { const el = document.getElementById('hub-toast'); return el && !el.hidden && /Hub updated/.test(el.textContent); }, null, { timeout: 6000 }).then(() => true).catch(() => false);
          if (ok) { await sleep(400); await d.page.screenshot({ path: path.join(OUT, 'verify-first-install-toast-webkit-iphone.png'), scale: 'css' }); shotTaken = true; }
        }
        await sleep(5000);
        const first = await d.page.evaluate(async () => ({ ...window.__v, controllerNow: !!navigator.serviceWorker.controller, regsNow: (await navigator.serviceWorker.getRegistrations()).length, pairingShown: !!document.querySelector('#pair, .pairing, [data-view="pairing"]') || /pairing code/i.test(document.body.innerText) }));
        // control: a plain second open (same context, sw.js unchanged)
        await d.page.reload({ waitUntil: 'load' });
        await d.page.waitForSelector(c.ready).catch(() => {});
        await sleep(4000);
        const second = await d.page.evaluate(() => ({ loadNo: window.__v.loadNo, controllerAtStart: window.__v.controllerAtStart, ev: window.__v.ev, toasts: window.__v.toasts }));
        const row = { run: i + 1, first, second };
        R.results[engine][c.name].push(row);
        console.log(engine, c.name, i + 1,
          'firstLoad:', JSON.stringify({ loadNo: first.loadNo, controllerAtStart: first.controllerAtStart, regsAtStart: first.regsAtStart, toasts: first.toasts.map(x => x.m.slice(0, 11) + '@' + x.t), visible: first.toastVisible && { hidden: first.toastVisible.hidden, display: first.toastVisible.display, h: first.toastVisible.h } }),
          '\n   events:', first.ev.map(e => `${e.t}ms ${e.e}${e.state ? '=' + e.state : ''}${e.wState ? '(' + e.wState + ')' : ''} ctrl=${e.controller}`).join(' | '),
          '\n   reload:', JSON.stringify({ loadNo: second.loadNo, controllerAtStart: second.controllerAtStart, toasts: second.toasts.map(x => x.m.slice(0, 11)), ev: second.ev.map(e => e.e + (e.state ? '=' + e.state : '')) }));
        await d.close();
      }
    }
  } finally { await L.close(); }
}
const summary = {};
for (const [eng, cases] of Object.entries(R.results)) for (const [c, rows] of Object.entries(cases)) {
  summary[`${eng}/${c}`] = {
    firstInstallLoads: rows.filter(r => r.first.loadNo === 1 && r.first.controllerAtStart === false && r.first.regsAtStart === 0).length + '/' + rows.length,
    toastOnFirstLoad: rows.filter(r => r.first.toasts.some(t => /Hub updated/.test(t.m))).length + '/' + rows.length,
    toastVisibleOnFirstLoad: rows.filter(r => r.first.toastVisible && !r.first.toastVisible.hidden && r.first.toastVisible.h > 0).length + '/' + rows.length,
    installedWithController: rows.filter(r => r.first.ev.some(e => e.e === 'statechange' && e.state === 'installed' && e.controller)).length + '/' + rows.length,
    toastOnReload: rows.filter(r => r.second.toasts.some(t => /Hub updated/.test(t.m))).length + '/' + rows.length,
  };
}
R.summary = summary;
R.screenshot = shotTaken ? 'audits/evidence/p2/STAB/verify-first-install-toast-webkit-iphone.png' : null;
fs.writeFileSync(path.join(OUT, 'verify-first-install-hub-updated-toast-1.json'), JSON.stringify(R, null, 1));
console.log('\nSUMMARY', JSON.stringify(summary, null, 1), '\nscreenshot:', R.screenshot);
