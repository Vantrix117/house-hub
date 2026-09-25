// Phase 4 MOTION — the park map on a park day, located and sharing: which infinite animations run while the phone sits
// in a pocket or on a table with the map open, what they cost on the main thread, and whether Reduce Motion stops them.
// Chromium (CDP metrics), variant 'park', real clock, iPhone PWA, Eli. The page is opened standalone; geolocation is
// granted and put inside the park (map point 762,842 as in audits/tools/phase3/dollywood-live/geo.mjs), then the Find
// me button (#loc-btn) is tapped. Arms: no-preference, reduce.
//   node "audits/tools/phase4/MOTION/park-live.mjs"  → audits/evidence/p4/MOTION/park-live.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const out = {};
const L = await local({ variant: 'park', clock: 'real', engine: 'chromium' });
try {
  for (const rm of ['no-preference', 'reduce']) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
    await d.page.emulateMedia({ reducedMotion: rm });
    await d.page.goto(L.site + '/apps/dollywood-live.html', { waitUntil: 'load' });
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && window.D && D.geo, null, { timeout: 20000 }).catch(() => {});
    const ll = await d.page.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [762, 842]);
    await d.ctx.setGeolocation({ ...ll, accuracy: 6 });
    await sleep(1500);
    const gps0 = await d.page.evaluate(() => document.getElementById('loc-btn') && document.getElementById('loc-btn').dataset.gps);
    if (gps0 !== 'on') { await d.page.click('#loc-btn').catch(() => {}); }
    await sleep(4000);
    const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Performance.enable');
    const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    const a = await m(); await sleep(10000); const b = await m();
    const st = await d.page.evaluate(() => {
      const run = document.getAnimations().filter(x => x.playState === 'running');
      return { gps: document.getElementById('loc-btn').dataset.gps, pill: document.getElementById('lv-pill').dataset.state, running: run.length, infinite: run.filter(x => x.effect.getComputedTiming().iterations === Infinity).map(x => `${x.animationName} ${x.effect.getComputedTiming().duration}ms`), collapsed: run.filter(x => x.effect.getComputedTiming().duration < 1).length };
    });
    out[rm] = { gpsBefore: gps0, ...st, busyPct: +(((b.TaskDuration - a.TaskDuration) / 10) * 100).toFixed(1), stylePerSec: +((b.RecalcStyleCount - a.RecalcStyleCount) / 10).toFixed(1) };
    console.log(rm, JSON.stringify(out[rm]));
    await d.page.screenshot({ path: path.join(EV, `park-live-located-${rm}-iphone.png`), scale: 'css', animations: 'disabled' }).catch(() => {});
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'park-live.json'), JSON.stringify(out, null, 1));
  await L.close();
}
