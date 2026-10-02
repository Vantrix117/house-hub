// E8: an ASLEEP document's queue is adopted while it still holds the rows in memory. Two tabs of one device (Eli).
// Tab B queues rows offline, then is frozen (CDP) and its heartbeat aged past 3 min; tab A writes a newer value of a shared
// key and, back online, adopts B's key and sends. Then B wakes and saves again from memory. Expect: nothing lost, the
// newer value wins on the house and in both caches, every hub.queue.* key empty, and no resend while idle (no loop).
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const P = { app: 'timer', scope: 'person' };
try {
  await L.reset('typical');
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); const A = d.page; const B = await d.ctx.newPage(); await B.goto(L.site + '/index.html#home');
  for (const p of [A, B]) await p.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && hub.isLoaded('timer', 'person'), null, { timeout: 30000 });
  const sends = []; let phase = 'run';
  for (const p of [A, B]) p.on('request', r => { if (r.url().includes('/api/data/timer/batch') && r.method() === 'POST') try { for (const it of JSON.parse(r.postData()).items) if (/^zz/.test(it.key)) sends.push({ phase, key: it.key, v: it.value }); } catch {} });
  const off = u => u.href.startsWith(L.api); await d.ctx.route(off, r => r.abort('internetdisconnected'));
  for (const p of [A, B]) await p.evaluate(() => { sessionStorage.setItem('rig.offline', '1'); dispatchEvent(new Event('offline')); });
  const bDoc = await B.evaluate(P => { for (let i = 0; i < 20; i++) hub.set('zzB:' + i, i, P); hub.set('zzshared', 'B-old', P); return Object.keys(localStorage).filter(k => /^hub\.queue\.timer\.person\.eli\./.test(k) && JSON.parse(localStorage.getItem(k) || '{}')['zzB:0']); }, P);
  console.log('B queued under', JSON.stringify(bDoc));
  const cdp = await d.ctx.newCDPSession(B); await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
  await sleep(300);
  await A.evaluate(([P, k]) => { const doc = k.split('.').pop(); localStorage.setItem('hub.qalive.' + doc, JSON.stringify(Date.now() - 200000)); hub.set('zzshared', 'A-new', P); }, [P, bDoc[0]]);
  await d.ctx.unroute(off); await A.evaluate(() => { sessionStorage.setItem('rig.offline', '0'); dispatchEvent(new Event('online')); });
  for (let i = 0; i < 20; i++) { await A.evaluate(() => hub.flush()); if (!(await A.evaluate(() => hub.sync.pending))) break; await sleep(250); }
  await sleep(800);
  const mid = await A.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => [k, Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length])));
  const srv1 = Object.fromEntries((((await L.apiAs('eli', '/api/data/timer?scope=person')).body.items) || []).filter(i => /^zz/.test(i.key)).map(i => [i.key, i.value]));
  console.log('after A adopted+sent (B frozen): queues', JSON.stringify(mid), 'house zzB rows', Object.keys(srv1).filter(k => k.startsWith('zzB')).length, 'zzshared', JSON.stringify(srv1.zzshared));
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await B.evaluate(() => { sessionStorage.setItem('rig.offline', '0'); dispatchEvent(new Event('online')); });
  await B.evaluate(P => hub.set('zzB:wake', 1, P), P);   // a save from B's memory
  for (let i = 0; i < 20; i++) { for (const p of [A, B]) await p.evaluate(() => hub.flush()); const pend = await Promise.all([A, B].map(p => p.evaluate(() => hub.sync.pending))); if (!pend[0] && !pend[1]) break; await sleep(300); }
  await sleep(1500); phase = 'idle';
  await sleep(35000);
  for (const p of [A, B]) await p.evaluate(() => hub.pull()); await sleep(1000);
  const srv = Object.fromEntries((((await L.apiAs('eli', '/api/data/timer?scope=person')).body.items) || []).filter(i => /^zz/.test(i.key)).map(i => [i.key, i.value]));
  const keysLeft = await A.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length));
  const caches = await Promise.all([A, B].map(p => p.evaluate(P => hub.get('zzshared', P), P)));
  const cnt = {}; for (const s of sends.filter(s => s.phase === 'run')) cnt[s.key + '=' + JSON.stringify(s.v)] = (cnt[s.key + '=' + JSON.stringify(s.v)] || 0) + 1;
  console.log('house: zzB rows', Object.keys(srv).filter(k => k.startsWith('zzB:')).length, '/ 21, zzshared', JSON.stringify(srv.zzshared), '| caches A,B', JSON.stringify(caches));
  console.log('non-empty queue keys after', JSON.stringify(keysLeft), '| sends while idle', sends.filter(s => s.phase === 'idle').length);
  console.log('zzshared sends', JSON.stringify(Object.entries(cnt).filter(([k]) => k.startsWith('zzshared'))), 'max sends of one row', Math.max(...Object.values(cnt)));
  console.log('qalive keys', await A.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.qalive.')).length));
} catch (e) { console.error(e); } finally { await L.close(); }
