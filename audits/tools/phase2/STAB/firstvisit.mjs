// STAB (5, lead check): does a brand-new install show "Hub updated"? (index.html:1692-1696 toasts on the installing worker's
// 'installed' state when navigator.serviceWorker.controller is set; sw.js skipWaiting + clients.claim can set it first.)
//   node "audits/tools/phase2/STAB/firstvisit.mjs" [runs=4]
// Each run: a fresh context with service workers allowed, Eli signed in, the first ever load of the shell. hub.toast is
// wrapped as soon as hub.js defines it (an init script polls for window.hub), and the SW events are logged.
// Output: audits/evidence/p2/STAB/firstvisit.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const RUNS = +(process.argv[2] || 4);
const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const R = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  R[engine] = [];
  try {
    for (let i = 0; i < RUNS; i++) {
      const d = await L.device({ device: 'ipad-portrait', profile: 'eli', sw: true, fixedTime: false });
      await d.ctx.addInitScript(() => {
        if (window !== window.top) return;
        window.__toastCalls = []; window.__sw = [];
        const iv = setInterval(() => { if (window.hub && hub.toast && !hub.toast.__w) { const t = hub.toast; hub.toast = (m, ms) => { window.__toastCalls.push(m); return t(m, ms); }; hub.toast.__w = 1; clearInterval(iv); } }, 5);
        if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', () => window.__sw.push('controllerchange'));
      });
      await d.goto('#home'); await d.page.waitForSelector('#view-home .card');
      await sleep(5000);
      const r = await d.page.evaluate(async () => ({ controller: !!navigator.serviceWorker.controller, reg: !!(await navigator.serviceWorker.getRegistration()), toastCalls: window.__toastCalls, sw: window.__sw }));
      R[engine].push(r); console.log(engine, i + 1, JSON.stringify(r));
      await d.close();
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(OUT, 'firstvisit.json'), JSON.stringify(R, null, 1));
