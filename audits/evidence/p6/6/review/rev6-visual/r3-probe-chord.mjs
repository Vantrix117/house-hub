// round 3: every line inside the dial (digits, label, state) stays inside the ring's inner edge
import { local, sleep } from './wr3/audits/tools/lib/local.mjs';
const OUT = process.argv[2];
const L = await local({ variant: 'typical', clock: 'real' });
const chord = () => document.fonts.ready.then(() => {
  const svg = document.querySelector('#dial .ring'), b = svg.getBoundingClientRect();
  const cx = b.left + b.width / 2, cy = b.top + b.height / 2, rin = (22 - 1.5) / 52 * b.width;
  const worst = {};
  for (const id of ['t', 'tlabel', 'tstate']) {
    const el = document.getElementById(id); const rg = document.createRange(); rg.selectNodeContents(el);
    const bx = el.getBoundingClientRect(); let mx = 0; for (const r0 of rg.getClientRects()) { const w = Math.min(r0.width, bx.width), mid = bx.left + bx.width / 2, r = { left: Math.max(bx.left, Math.min(r0.left, mid - w / 2)), top: r0.top, bottom: r0.bottom }; r.right = r.left + w; for (const [x, y] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]]) mx = Math.max(mx, Math.hypot(x - cx, y - cy)); }
    worst[id] = { over: Math.round(mx - rin), text: el.textContent.trim().slice(0, 24) };
  }
  return worst;
});
for (const prof of ['mom', 'ezra']) for (const xxl of [false, true]) for (const [dev, w, h] of [['iphone-pwa', 375, 667], ['iphone-pwa', 390, 844], ['ipad-portrait', 820, 1180]]) {
  const d = await L.device({ device: dev, profile: prof, fixedTime: false });
  await d.page.setViewportSize({ width: w, height: h });
  const f = await d.openApp('timer');
  await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 });
  if (xxl) { await d.page.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); }
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); });
  const out = {};
  await f.evaluate(() => { const r = hub.timers.start({ total: 4 * 3600000 + 5000, label: 'Slow-roasted pork shoulder for Sunday dinner' }); hub.timers.pause(hub.timers.get(r.id)); });
  await sleep(700); out.pausedLong = await f.evaluate(chord);
  await d.shot(`${OUT}/chord-${prof}-${xxl ? 'xxl' : 'std'}-${w}.png`);
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); hub.timers.start({ total: 1200, label: 'Bread rolls for the potluck' }); });
  await sleep(2500); out.ringing = await f.evaluate(chord);
  const bad = Object.entries(out).flatMap(([k, v]) => Object.entries(v).filter(([, z]) => z.over > 0).map(([id, z]) => `${k}.${id}+${z.over}px`));
  console.log(prof, xxl ? 'xxl' : 'std', w, bad.length ? 'OVER ' + bad.join(' ') : 'inside', JSON.stringify(out));
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); });
  await d.close();
}
await L.close();
