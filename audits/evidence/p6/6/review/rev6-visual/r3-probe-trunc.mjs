import { local, sleep } from './wr3/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real' });
for (const prof of ['ezra', 'mom']) for (const xxl of [false, true]) for (const [dev, w, h] of [['iphone-pwa', 375, 667], ['iphone-pwa', 390, 844], ['ipad-portrait', 820, 1180]]) {
  const d = await L.device({ device: dev, profile: prof, fixedTime: false });
  await d.page.setViewportSize({ width: w, height: h });
  const f = await d.openApp('timer');
  await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 });
  if (xxl) await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); hub.timers.start({ total: 1200, label: 'Tea' }); });
  await sleep(2500);
  const ring = await f.evaluate(() => { const e = document.getElementById('tstate'), s = e.querySelector('span') || e; return { text: e.innerText.trim(), cut: s.scrollWidth > s.clientWidth + 1 || e.scrollWidth > e.clientWidth + 1 }; });
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); const r = hub.timers.start({ total: 600000 }); hub.timers.pause(hub.timers.get(r.id)); });
  await sleep(600);
  const pause = await f.evaluate(() => { const e = document.getElementById('tstate'), s = e.querySelector('span') || e; return { text: e.innerText.trim(), cut: s.scrollWidth > s.clientWidth + 1 || e.scrollWidth > e.clientWidth + 1 }; });
  if (prof === 'ezra' && xxl && w === 375) await d.shot('r3/trunc-ezra-xxl-375-paused.png');
  console.log(prof, xxl ? 'xxl' : 'std', w, 'ringing', JSON.stringify(ring), 'paused', JSON.stringify(pause));
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); });
  await d.close();
}
await L.close();
