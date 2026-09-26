// Skeptic s1, UX-KIDVERSE-2 (and UX-KIDVERSE-1 / VIS-KIDVERSE-1 side checks): where do "Read it to me", Done ★, the
// stars card, the story's "Read it to me" and "I heard it" sit relative to the first screen, measured in the SHELL
// (page coordinates, so the viewer bar is counted), for kid Ezra on every default device. Also reads the rendered
// colours of an unearned day letter and its dot so the contrast can be recomputed from the page, not the tokens.
//   node "audits/tools/phase5/ux-verify/UX-KIDVERSE-2/s1-fold.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits', 'evidence', 'p5', 'ux-verify', 'UX-KIDVERSE-2', 's1');
fs.mkdirSync(OUT, { recursive: true });
const res = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
    const d = await L.device({ device, profile: 'ezra', mode: 'light' });
    try {
      const f = await d.openApp('kidverse');
      await f.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      const vh = d.page.viewportSize().height;
      const r = { vh, vw: d.page.viewportSize().width };
      for (const [k, sel] of Object.entries({ say: '#say', done: '#done', stars: '#mine', storySay: '#story-say', heard: '#story-heard' })) {
        const h = await f.$(sel); const b = h && await h.boundingBox();
        r[k] = b ? { top: Math.round(b.y), bottom: Math.round(b.y + b.height), visiblePx: Math.max(0, Math.min(vh, b.y + b.height) - Math.max(0, b.y)), h: Math.round(b.height), fullyVisible: b.y >= 0 && b.y + b.height <= vh } : null;
      }
      const fr = await (await f.frameElement()).boundingBox(); r.frameTop = Math.round(fr.y);
      r.labels = await f.evaluate(() => ({ say: document.querySelector('#say').textContent.trim(), storySay: document.querySelector('#story-say').textContent.trim(), heard: document.querySelector('#story-heard').textContent.trim(), storySub: document.querySelector('#story-sub').textContent.trim() }));
      if (device === 'iphone-pwa') {
        r.dayLetter = await f.evaluate(() => { const s = [...document.querySelectorAll('#mine .days span')].find(e => !e.classList.contains('on')); const cs = getComputedStyle(s); return { text: s.textContent, color: cs.color, bg: cs.backgroundColor, fs: cs.fontSize }; });
        r.theme = await f.evaluate(() => document.documentElement.getAttribute('data-theme'));
      }
      await d.page.screenshot({ path: path.join(OUT, `first-screen-${device}.png`), scale: 'css', animations: 'disabled' });
      res[device] = r;
      console.log(device, JSON.stringify(r));
    } finally { await d.close(); }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'fold.json'), JSON.stringify(res, null, 1));
