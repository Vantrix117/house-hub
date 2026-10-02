// independent: the dial box, #go, the presets and the label inside the dial through idle → running → paused → ringing → stopped
import { local, sleep } from './wr3/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real' });
for (const [dev, w, h, prof] of [['iphone-pwa', 390, 844, 'mom'], ['ipad-portrait', 820, 1180, 'mom'], ['iphone-pwa', 390, 844, 'ezra']]) {
  const d = await L.device({ device: dev, profile: prof, fixedTime: false });
  await d.page.setViewportSize({ width: w, height: h });
  const f = await d.openApp('timer');
  await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 });
  await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); });
  await sleep(500);
  const m = () => f.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)].join(','); }; return { dial: r('#dial'), go: r('#go'), pre: r('#presets'), t: r('#t'), lab: r('#tlabel'), st: r('#tstate'), goTxt: document.querySelector('#go .lbl').textContent }; });
  const out = {};
  // label first so the label line shows in every state
  await f.fill('#label', 'Soup').catch(() => {});
  out.idle = await m();
  await f.evaluate(() => { document.getElementById('custom-btn').click(); document.getElementById('cm').value = '0'; document.getElementById('cs').value = '4'; document.getElementById('cset').click(); });
  await sleep(200); await f.click('#go'); await sleep(600); out.running = await m();
  await f.click('#go'); await sleep(400); out.paused = await m();
  await f.click('#go'); await sleep(5200); out.ringing = await m();
  await f.click('#go'); await sleep(600); out.stopped = await m();
  console.log(dev, w, prof, JSON.stringify(out));
  await d.close();
}
await L.close();
