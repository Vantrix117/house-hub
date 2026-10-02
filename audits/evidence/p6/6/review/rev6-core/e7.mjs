// E7: saveQueue's merge under stress — the shell and the Timer frame write the same channel every 40 ms for 12 s (online,
// flushing as they go; then a 3 s offline spell in the middle), overwriting shared keys and deleting some. Afterwards:
// every queue empty, the house holds each key's LAST value (a delete stays deleted), and no key is ever sent again once
// idle (no resend loop). Counts how often each (key, updated_at) went out.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  await L.reset('typical');
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const sends = []; let phase = 'busy';
  d.page.on('request', req => { if (/\/api\/data\/timer\/batch\?scope=person/.test(req.url()) && req.method() === 'POST') { try { for (const it of JSON.parse(req.postData()).items) sends.push({ phase, key: it.key, t: it.updated_at, v: it.value }); } catch {} } });
  const f = await d.openApp('timer', { wait: '#go' });
  await f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 20000 });
  const writer = who => `(() => { let n = 0; window.__w = setInterval(() => { n++; const k = 'zz:' + (n % 7); try { if (n % 5 === 0) hub.remove(k, { app: 'timer', scope: 'person' }); else hub.set(k, { who: '${who}', n, at: Date.now() }, { app: 'timer', scope: 'person' }); hub.set('zz:${who}:' + n, n, { app: 'timer', scope: 'person' }); } catch (e) { window.__err = String(e); } }, 40); })()`;
  await d.page.evaluate(writer('shell')); await f.evaluate(writer('frame'));
  await sleep(4500); await d.setOffline(true); await sleep(3000); await d.setOffline(false); await sleep(4500);
  await d.page.evaluate(() => clearInterval(window.__w)); await f.evaluate(() => clearInterval(window.__w));
  // the last value each document wrote for each shared key: whichever has the larger stamp in its own cache
  for (let i = 0; i < 40; i++) { await d.page.evaluate(() => hub.flush()); await f.evaluate(() => hub.flush()); const p = await d.page.evaluate(() => hub.sync.pending); if (!p) break; await sleep(250); }
  await sleep(1500);
  phase = 'idle';
  const local1 = await d.page.evaluate(() => { const c = JSON.parse(localStorage.getItem('hub.cache.timer.person.eli') || '{}').items || {}; return Object.fromEntries(Object.entries(c).filter(([k]) => /^zz:\d$/.test(k)).map(([k, it]) => [k, it])); });
  const qs = await d.page.evaluate(() => ({ ls: localStorage.getItem('hub.queue.timer.person.eli'), pend: hub.sync.pending }));
  const qf = await f.evaluate(() => ({ pend: hub.sync.pending }));
  await sleep(40000);   // idle: pulls every 30 s; nothing should be resent
  const idle = sends.filter(s => s.phase === 'idle');
  const srv = (((await L.apiAs('eli', '/api/data/timer?scope=person')).body.items) || []);
  const bySrv = Object.fromEntries(srv.filter(i => /^zz:\d$/.test(i.key)).map(i => [i.key, { v: i.value, t: i.updated_at }]));
  let mismatch = [];
  for (const [k, it] of Object.entries(local1)) { const s = bySrv[k]; if (!s || JSON.stringify(s.v) !== JSON.stringify(it.v)) mismatch.push({ k, local: it, server: s }); }
  const own = srv.filter(i => /^zz:(shell|frame):/.test(i.key));
  const wrote = await d.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hub.cache.timer.person.eli') || '{}').items || {}).filter(k => /^zz:(shell|frame):/.test(k)).length);
  const cnt = {}; for (const s of sends) { const k = s.key + '@' + s.t; cnt[k] = (cnt[k] || 0) + 1; }
  const hist = {}; for (const n of Object.values(cnt)) hist[n] = (hist[n] || 0) + 1;
  console.log('rows sent (key@stamp) by times sent:', JSON.stringify(hist), 'total posts items', sends.length);
  console.log('queues after: shell', JSON.stringify(qs), 'frame', JSON.stringify(qf));
  console.log('unique rows the documents wrote', wrote, 'on the house', own.length);
  console.log('shared keys: local last value vs house mismatches', JSON.stringify(mismatch).slice(0, 800));
  console.log('sent while idle 40 s:', idle.length, JSON.stringify(idle.slice(0, 5)));
  console.log('errors', await d.page.evaluate(() => window.__err || null), await f.evaluate(() => window.__err || null));
} catch (e) { console.error(e); } finally { await L.close(); }
