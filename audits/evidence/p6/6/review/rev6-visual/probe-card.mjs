// the Home timer card with a ringing timer + a running one, after the toast has gone; and Eli's pill after a Switch
import { local, sleep } from './wt/audits/tools/lib/local.mjs';
const OUT = process.argv[2];
const L = await local({ variant: 'typical', clock: 'real' });
for (const [dev, w, h] of [['iphone-pwa', 390, 844], ['ipad-portrait', 820, 1180], ['ipad-landscape', 1180, 820]]) {
  const d = await L.device({ device: dev, profile: 'mom', fixedTime: false });
  await d.page.setViewportSize({ width: w, height: h });
  await d.goto('#home');
  await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull, null, { timeout: 10000 }).catch(() => {});
  await d.page.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) { try { await hub.timers.clear(r.id, r.startedAt); } catch {} } });
  await sleep(500);
  await d.page.evaluate(() => { hub.timers.start({ total: 720000, label: 'Pasta' }); hub.timers.start({ total: 1500, label: 'Bread rolls for the potluck' }); });
  await sleep(11000);
  await d.page.evaluate(() => { const c = document.getElementById('home-timer'); if (c) c.scrollIntoView({ block: 'center' }); });
  await sleep(500);
  const card = await d.page.evaluate(() => { const c = document.getElementById('home-timer'); if (!c) return null; const rows = [...c.querySelectorAll('.tm-row')].map(r => { const w = r.querySelector('.tm-what').getBoundingClientRect(); return { text: r.innerText.replace(/\s+/g, ' '), whatW: Math.round(w.width), whatH: Math.round(w.height) }; }); return rows; });
  console.log(dev, w, JSON.stringify(card));
  await d.shot(`${OUT}/card-${w}.png`);
  await d.page.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) { try { await hub.timers.clear(r.id, r.startedAt); } catch {} } });
  await d.close();
}
await L.close();
