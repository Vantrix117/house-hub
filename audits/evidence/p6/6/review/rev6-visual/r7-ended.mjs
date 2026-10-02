import { local, sleep } from './wr7/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real' });
for (const [prof, xxl, dev, w, h] of [['mom', false, 'iphone-pwa', 375, 667], ['mom', false, 'iphone-pwa', 390, 844], ['mom', true, 'iphone-pwa', 390, 844], ['mom', false, 'ipad-portrait', 820, 1180], ['ezra', false, 'iphone-pwa', 390, 844], ['ezra', true, 'iphone-pwa', 375, 667], ['ezra', true, 'ipad-portrait', 820, 1180]]) {
  const d = await L.device({ device: dev, profile: prof, fixedTime: false }); await d.page.setViewportSize({ width: w, height: h });
  const f = await d.openApp('timer'); await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 });
  if (xxl) await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); const n = hub.serverNow(); hub.timers.put({ id: 'b' + Math.round(n), label: 'Bread', total: 600000, startedAt: n - 780000, endAt: n - 180000 }, { fresh: true }); });
  await sleep(1200);
  const r = await f.evaluate(() => { const e = document.getElementById('tstate'), s = e.querySelector('span'); return { text: e.innerText.trim(), shown: s && s.scrollWidth > s.clientWidth + 1 ? 'CUT' : 'whole', sw: s && s.scrollWidth, cw: s && s.clientWidth }; });
  console.log(prof, xxl ? 'xxl' : 'std', w, JSON.stringify(r));
  if (r.shown === 'CUT') await d.shot(`r6/ended-cut-${prof}-${xxl ? 'xxl' : 'std'}-${w}.png`);
  await d.close();
}
await L.close();
