// Skeptic #1 for "out-of-frame-stale-reads-live": does a restored (stale) fix outside the map frame read as live?
// Restores dollywood.live.last (taken as stale when < 12 h old, apps/dollywood-live.html:1478) and reads the pill (updLoc :1260-1291).
// Run: node "audits/tools/phase3/dollywood-live/verify-out-of-frame-stale-reads-live-1.mjs"
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'evidence', 'p3', 'dollywood-live');
const P = 'verify-out-of-frame-stale-reads-live-1';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const ago = m => Date.now() - m * 60000;
const cases = {
  arriving_90min: { x: 700, y: 2318, acc: 9, hdg: null, t: ago(90), src: 'gps', sec: null },
  arriving_10h:   { x: 700, y: 2318, acc: 9, hdg: null, t: ago(600), src: 'gps', sec: null },
  far_90min:      { x: -9000, y: 12500, acc: 14, hdg: null, t: ago(90), src: 'gps', sec: null },
  inFrame_90min:  { x: 762, y: 842, acc: 6, hdg: null, t: ago(90), src: 'gps', sec: 'timber' },
};
try {
  for (const [name, fix] of Object.entries(cases)) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, localStorage: { 'dollywood.live.last': JSON.stringify(fix) } });
    await d.goto('#home'); await sleep(1000);
    const f = await d.openApp('dollywood-live');
    await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
    await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
    await sleep(2500);
    out[name] = await f.evaluate(() => {
      const $ = id => document.getElementById(id);
      const dot = document.querySelector('#lv-me, .lv-me') ;
      return {
        state: $('lv-pill').dataset.state, title: $('loc-sec').textContent, sub: $('loc-acc').textContent,
        actionChip: $('lv-act').hidden ? null : $('lv-act').textContent,
        meStale: !!(me && me.stale), fixAgeMin: Math.round(fixAge() / 60000), watchRunning: watchId != null,
        warnClass: $('loc-sec').classList.contains('warn'),
        locBtnVisible: !!$('loc-btn') && !$('loc-btn').hidden && getComputedStyle($('loc-btn')).display !== 'none',
        dotGreyClass: !!(G.me && G.me.classList.contains('lv-stale')),
      };
    });
    if (name !== 'arriving_10h') await d.page.screenshot({ path: path.join(EV, `${P}-${name}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, `${P}.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await L.close();
}
