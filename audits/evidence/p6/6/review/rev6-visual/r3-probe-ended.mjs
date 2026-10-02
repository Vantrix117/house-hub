// round 3: the ended-unseen note must not move the controls (appear and OK)
import { local, sleep } from './wr3/audits/tools/lib/local.mjs';
const OUT = process.argv[2];
const L = await local({ variant: 'typical', clock: 'real' });
for (const [dev, w, h, prof] of [['iphone-pwa', 390, 844, 'mom'], ['iphone-pwa', 375, 667, 'mom'], ['ipad-portrait', 820, 1180, 'mom'], ['iphone-pwa', 390, 844, 'ezra']]) {
  const d = await L.device({ device: dev, profile: prof, fixedTime: false });
  await d.page.setViewportSize({ width: w, height: h });
  const f = await d.openApp('timer');
  await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 });
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); });
  await sleep(400);
  const m = () => f.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return Math.round(b.top) + '/' + Math.round(b.height); }; return { go: r('#go'), reset: r('#reset'), pre: r('#presets'), ended: r('#ended'), goTxt: document.querySelector('#go .lbl').textContent }; });
  const r = { before: await m() };
  await f.evaluate(() => { const n = hub.serverNow(); hub.timers.put({ id: 'bread' + Math.round(n), label: 'Bread', total: 600000, startedAt: n - 780000, endAt: n - 180000 }, { fresh: true }); });
  await sleep(1200); r.shown = await m();
  await d.shot(`${OUT}/ended-${prof}-${w}.png`);
  await f.click('#ended-ok').catch(e => { r.err = e.message.slice(0, 60); }); await sleep(400); r.ok = await m();
  console.log(dev, w, prof, JSON.stringify(r));
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); });
  await d.close();
}
await L.close();
