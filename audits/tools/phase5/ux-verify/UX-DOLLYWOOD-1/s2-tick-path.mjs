// Phase 5 ux-verify, skeptic s2, UX-DOLLYWOOD-1: how far is Mark done from opening the build guide, per device?
// Records where #b-done sits at open (and after raising the phone sheet), which section/step the guide opens on, and
// whether Home carries any build-guide card or shortcut. Ticks nothing (no writes).
//   node "audits/tools/phase5/ux-verify/UX-DOLLYWOOD-1/s2-tick-path.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p5/ux-verify/UX-DOLLYWOOD-1/s2');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const where = f => f.evaluate(() => {
  const b = document.getElementById('b-done'), r = b && b.getBoundingClientRect(), sh = document.getElementById('build').getBoundingClientRect();
  const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
  return { vh: innerHeight, scrollY: Math.round(scrollY), sheetState: document.getElementById('build').dataset.state || null, sheetTop: Math.round(sh.top),
    doneTop: r && Math.round(r.top), doneBottom: r && Math.round(r.bottom), doneH: r && Math.round(r.height), doneW: r && Math.round(r.width),
    doneTappable: !!hit && (hit === b || b.contains(hit)), section: document.getElementById('b-sec').textContent, count: document.getElementById('b-count').textContent,
    step: (document.querySelector('#b-now h3') || {}).textContent,
    progressBySection: [...document.querySelectorAll('#chips button .cl')].map(c => c.textContent.replace(/\s+/g, ' ').trim()) };
});

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'ipad-portrait', 'desktop']) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    await d.goto('');
    await sleep(2500);
    const home = await d.page.evaluate(() => ({ homeText: /dollywood|build guide/i.test((document.querySelector('#home, [data-tab=home], main') || document.body).innerText),
      dataOpenDollywood: document.querySelectorAll('[data-open="dollywood"]').length }));
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await sleep(600);
    const atOpen = await where(f);
    let afterHandle = null;
    if (device === 'iphone-pwa') { await f.evaluate(() => document.getElementById('bh-handle').click()); await sleep(700); afterHandle = await where(f); }
    await d.page.screenshot({ path: path.join(EV, `${device}-open.png`), animations: 'disabled', caret: 'hide' }).catch(() => {});
    log(device, { home, atOpen, afterHandle });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'result.json'), JSON.stringify(out, null, 1));
  await L.close();
}
