// does #tstate's markup get rebuilt on every 250 ms render while paused / ringing?
import { local, sleep } from './wr3/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real' });
const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false });
const f = await d.openApp('timer');
await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 15000 });
await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); });
const count = async label => {
  const n = await f.evaluate(async () => { let n = 0; const ts = document.getElementById('tstate'); const mo = new MutationObserver(m => { n += m.length; }); mo.observe(ts, { childList: true, subtree: true }); await new Promise(r => setTimeout(r, 3000)); mo.disconnect(); return { n, html: ts.innerHTML.slice(0, 120) }; });
  console.log(label, JSON.stringify(n));
};
await f.evaluate(() => { const r = hub.timers.start({ total: 600000, label: 'Soup' }); hub.timers.pause(hub.timers.get(r.id)); });
await sleep(800); await count('paused');
await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); hub.timers.start({ total: 1200, label: 'Tea' }); });
await sleep(2500); await count('ringing');
// the shell pill: does the ringing pill's <use> get its href reset every second?
const n2 = await d.page.evaluate(async () => { let n = 0; const p = document.getElementById('pill-timer'); const mo = new MutationObserver(m => { n += m.length; }); mo.observe(p, { attributes: true, subtree: true, attributeFilter: ['href'] }); await new Promise(r => setTimeout(r, 3000)); mo.disconnect(); return n; });
console.log('chip use href mutations in 3 s', n2);
await f.evaluate(async () => { for (const r of hub.timers.list({ stale: true })) await hub.timers.clear(r.id, r.startedAt); });
await L.close();
