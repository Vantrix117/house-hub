// Skeptic #2 for "out-of-frame-stale-reads-live": does a restored (stale) fix outside the map frame get the
// stale treatment (Last seen / Find me) that an in-frame one gets? Also looks for mitigations: amber .warn title,
// the "N ago" tag on the dot (drawMe :1202), the always-present ◎ locate button (#loc-btn), and an 11 h "next morning" case.
// Run: node "audits/tools/phase3/dollywood-live/verify-out-of-frame-stale-reads-live-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
fs.mkdirSync(EV, { recursive: true });
const P = 'verify-out-of-frame-stale-reads-live-2';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const ago = m => Date.now() - m * 60000;
const cases = {
  arriving90m: { x: 700, y: 2318, acc: 9, hdg: null, t: ago(90), src: 'gps', sec: null },
  arriving11h: { x: 700, y: 2318, acc: 9, hdg: null, t: ago(660), src: 'gps', sec: null },
  far90m:      { x: -9000, y: 12500, acc: 14, hdg: null, t: ago(90), src: 'gps', sec: null },
  inFrame90m:  { x: 762, y: 842, acc: 6, hdg: null, t: ago(90), src: 'gps', sec: 'timber' },
};
try {
  for (const [name, fix] of Object.entries(cases)) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, localStorage: { 'dollywood.live.last': JSON.stringify(fix) } });
    await d.goto('#home'); await sleep(1000);
    const f = await d.openApp('dollywood-live');
    await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
    await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
    await sleep(2000);
    out[name] = await f.evaluate(() => {
      const sec = document.getElementById('loc-sec'), act = document.getElementById('lv-act'), btn = document.getElementById('loc-btn');
      const tag = document.querySelector('#me .me-tag');
      const svgR = document.querySelector('svg').getBoundingClientRect();
      let tagVisible = null;
      if (tag) { const r = tag.getBoundingClientRect(); tagVisible = r.width > 0 && r.bottom > svgR.top && r.top < svgR.bottom && r.right > svgR.left && r.left < svgR.right; }
      return {
        meStale: !!(me && me.stale), watchRunning: watchId != null,
        state: document.getElementById('lv-pill').dataset.state,
        title: sec.textContent, titleWarnClass: sec.classList.contains('warn'), titleColor: getComputedStyle(sec).color,
        sub: document.getElementById('loc-acc').textContent,
        pillAction: act.hidden ? null : act.textContent,
        locBtn: btn ? { hidden: btn.hidden, gps: btn.dataset.gps, label: btn.getAttribute('aria-label') } : null,
        dotTag: tag ? tag.textContent : null, dotTagOnScreen: tagVisible,
        liveBadgeHidden: document.getElementById('lv-live') ? document.getElementById('lv-live').hidden : null,
      };
    });
    if (name !== 'inFrame90m') await d.page.screenshot({ path: path.join(EV, `${P}-${name}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    console.log(name, JSON.stringify(out[name]));
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, `${P}.json`), JSON.stringify(out, null, 2));
  console.log('wrote', path.join(EV, `${P}.json`));
  await L.close();
}
