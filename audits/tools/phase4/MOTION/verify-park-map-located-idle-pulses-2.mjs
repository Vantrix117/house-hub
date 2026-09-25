// Phase 4 MOTION skeptic #2 for "park-map-located-idle-pulses". Independent re-measure.
// Chromium (CDP Performance metrics), variant 'park', real clock, iPhone PWA, Eli, map opened standalone, geolocation
// granted inside the park (map point 762,842), Find me tapped if not already on. In ONE located page, 10 s windows:
//   A asShipped · B allPaused (every running animation paused = the GPS watch + sync alone) · C mepulseOnly (lvlive+fabring
//   paused) · D boxShadowOnly (mepulse paused) · A2 asShipped again (drift check). Then a reduce arm, then WebKit (no CDP)
//   to confirm the same four infinite animations tick on the iPhone's engine.
//   node "audits/tools/phase4/MOTION/verify-park-map-located-idle-pulses-2.mjs" → audits/evidence/p4/MOTION/verify-park-map-located-idle-pulses-2.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const OUT = path.join(EV, 'verify-park-map-located-idle-pulses-2.json');
const out = { chromium: {}, webkit: {} };

async function located(L, rm) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
  await d.page.emulateMedia({ reducedMotion: rm });
  await d.page.goto(L.site + '/apps/dollywood-live.html', { waitUntil: 'load' });
  await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && window.D && D.geo, null, { timeout: 20000 }).catch(() => {});
  const ll = await d.page.evaluate(([x, y]) => ({ latitude: y / D.geo.my + D.geo.lat0, longitude: x / D.geo.mx + D.geo.lon0 }), [762, 842]);
  await d.ctx.setGeolocation({ ...ll, accuracy: 6 });
  await sleep(1500);
  const g = await d.page.evaluate(() => document.getElementById('loc-btn')?.dataset.gps);
  if (g !== 'on') await d.page.click('#loc-btn').catch(() => {});
  await sleep(4000);
  return d;
}
const state = d => d.page.evaluate(() => {
  const run = document.getAnimations().filter(x => x.playState === 'running');
  return { gps: document.getElementById('loc-btn')?.dataset.gps, pill: document.getElementById('lv-pill')?.dataset.state,
    fabPressed: document.querySelector('.fab-primary[aria-pressed=true]') ? true : false,
    svgNodes: document.querySelectorAll('svg *').length,
    running: run.map(x => ({ name: x.animationName, dur: x.effect.getComputedTiming().duration, iter: String(x.effect.getComputedTiming().iterations), tag: x.effect.target?.tagName, cls: x.effect.target?.getAttribute('class') || x.effect.target?.id })) };
});
// Arms switch animations with an injected stylesheet (animation-play-state), then report what is actually running.
const setPaused = (d, names) => d.page.evaluate(n => {
  let st = document.getElementById('p4v-arm'); if (!st) { st = document.createElement('style'); st.id = 'p4v-arm'; document.head.appendChild(st); }
  const sel = { mepulse: '.me-pulse,.me-pulse2', lvlive: '.lv-live', fabring: '.fab-primary' };
  st.textContent = n.map(k => sel[k] + '{animation-play-state:paused!important}').join(' ');
}, names);
const playing = d => d.page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName));

let L = await local({ variant: 'park', clock: 'real', engine: 'chromium' });
try {
  const d = await located(L, 'no-preference');
  const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Performance.enable');
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const win = async label => { const a = await m(); await sleep(10000); const b = await m();
    const r = { busyPct: +(((b.TaskDuration - a.TaskDuration) / 10) * 100).toFixed(1), stylePerSec: +((b.RecalcStyleCount - a.RecalcStyleCount) / 10).toFixed(1), layoutPerSec: +((b.LayoutCount - a.LayoutCount) / 10).toFixed(1), recalcStyleMsPerSec: +(((b.RecalcStyleDuration - a.RecalcStyleDuration) / 10) * 1000).toFixed(1) };
    r.running = await playing(d); out.chromium[label] = r; console.log(label, JSON.stringify(r)); };
  out.chromium.state = await state(d); console.log('state', JSON.stringify(out.chromium.state));
  await win('A_asShipped');
  await setPaused(d, ['mepulse', 'lvlive', 'fabring']); await sleep(500); await win('B_allPaused');
  await setPaused(d, ['lvlive', 'fabring']); await sleep(500); await win('C_mepulseOnly');
  await setPaused(d, ['mepulse']); await sleep(500); await win('D_boxShadowOnly');
  await setPaused(d, []); await sleep(500); await win('A2_asShipped');
  await d.page.screenshot({ path: path.join(EV, 'verify-park-map-located-idle-pulses-2-chromium-iphone.png'), scale: 'css', animations: 'disabled' }).catch(() => {});
  await d.close();
  const r = await located(L, 'reduce');
  out.chromium.reduce = await state(r);
  const cdp2 = await r.ctx.newCDPSession(r.page); await cdp2.send('Performance.enable');
  const m2 = async () => Object.fromEntries((await cdp2.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const a = await m2(); await sleep(10000); const b = await m2();
  out.chromium.reduce.busyPct = +(((b.TaskDuration - a.TaskDuration) / 10) * 100).toFixed(1);
  console.log('reduce', JSON.stringify(out.chromium.reduce));
  await r.close();
} catch (e) { out.chromium.error = String(e); console.log(e); }
finally { await L.close(); }

L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
try {
  const d = await located(L, 'no-preference');
  const s = await state(d);
  const t0 = await d.page.evaluate(() => document.getAnimations().map(a => [a.animationName, a.currentTime]));
  await sleep(3000);
  const t1 = await d.page.evaluate(() => document.getAnimations().map(a => [a.animationName, a.currentTime]));
  out.webkit = { ...s, advanceMs: t1.map((x, i) => [x[0], Math.round((x[1] ?? 0) - (t0[i]?.[1] ?? 0))]) };
  console.log('webkit', JSON.stringify(out.webkit));
  await d.close();
} catch (e) { out.webkit.error = String(e); console.log(e); }
finally { await L.close(); fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); }
