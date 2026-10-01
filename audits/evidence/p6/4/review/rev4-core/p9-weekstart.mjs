// Probe 9: why f260-a-4's "first tick dates the week" check fails: tick 39-0..4 on the plan list, then read the server rows over time.
import { local, sleep, DEMO, rows, texts, ready } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  await L.reset('typical');
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' }); const f = await d.openApp('f260'); await ready(f);
  out.before = await f.evaluate(() => ({ ws39: (hub.get('f260.weekStart') || {})['39'], q: Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => Object.keys(JSON.parse(localStorage.getItem(k)))) }));
  await f.evaluate(() => { for (let i = 0; i < 5; i++) document.querySelector('[data-day="39-' + i + '"] .mark').click(); });
  for (const t of [300, 1500, 4000, 8000]) {
    await sleep(t === 300 ? 300 : t - (t === 1500 ? 300 : t === 4000 ? 1500 : 4000));
    const r = await rows(L, 'eli');
    out['t' + t] = { serverWs39: (r['f260.weekStart'] || {})['39'], serverWd39: (r['f260.weekDone'] || {})['39'], local: await f.evaluate(() => ({ ws39: (hub.get('f260.weekStart') || {})['39'], sync: hub.sync.state, queued: Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => Object.keys(JSON.parse(localStorage.getItem(k))).join(',')).join(' | ') })) };
  }
  out.logs = d.logs.slice(-8);
} catch (e) { out.err = String(e && e.stack || e); }
finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
