// E1: a device offline (or whose first pull after waking fails) sweeps on its stale cache and deletes a timer another
// device paused. E5: two devices migrate one timer.active at once.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const log = (...a) => console.log(...a);
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const rows = async pid => (((await L.apiAs(pid, '/api/data/timer?scope=person')).body.items) || []).filter(i => /^timer/.test(i.key));
const mir = async () => (((await L.apiAs('eli', '/api/data/timer?scope=family')).body.items) || []).filter(i => /^run:/.test(i.key));
const ready = d => d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0 && hub.isLoaded('timer', 'person'), null, { timeout: 30000 });
try {
  await L.reset('typical');
  log('## E1: offline device sweeps a paused timer');
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() });
  const B = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await A.goto('#home'); await B.goto('#home'); await ready(A); await ready(B);
  // nothing else of Eli's: clear the seeded timers first, through B
  const r = await A.page.evaluate(async () => { const r = hub.timers.start({ total: 60000, label: 'e1' }); await hub.flush(); return r; });
  log('started on A', r.id, 'endAt-now', r.endAt - Date.now());
  await B.page.evaluate(() => hub.pull()); await sleep(500);
  await A.setOffline(true); await sleep(300);
  const p = await B.page.evaluate(async id => { const x = hub.timers.list().find(y => y.id === id); const q = hub.timers.pause(x); await hub.flush(); return q; }, r.id);
  log('B paused:', !!p && p.pausedAt > 0, 'server:', JSON.stringify((await rows('eli')).filter(x => x.key === 'timer:' + r.id).map(x => ({ pausedAt: x.value && x.value.pausedAt, endAt: x.value && x.value.endAt }))));
  // A stays offline; 12 minutes pass on A
  await A.ctx.clock.fastForward(12 * 60000); await sleep(1500);
  const before = await A.page.evaluate(id => ({ list: hub.timers.list({ stale: true }).filter(x => x.id === id).map(x => x.state), q: JSON.parse(localStorage.getItem('hub.queue.timer.person.eli') || '{}') }), r.id);
  log('A (offline, 12 min later) sees', JSON.stringify(before.list), 'queued:', JSON.stringify(Object.keys(before.q)));
  await A.page.evaluate(() => hub.pull()); await sleep(800);   // a pull that cannot reach the house (offline / the network not up yet on wake)
  const after = await A.page.evaluate(() => JSON.parse(localStorage.getItem('hub.queue.timer.person.eli') || '{}'));
  log('A queue after a failed pull:', JSON.stringify(after));
  await A.setOffline(false);
  await A.page.evaluate(async () => { for (let i = 0; i < 20; i++) { await hub.flush(); if (!hub.sync.pending) break; await new Promise(r => setTimeout(r, 250)); } });
  await sleep(500);
  const srv = (await rows('eli')).filter(x => x.key === 'timer:' + r.id);
  log('server after A is back:', JSON.stringify(srv.map(x => x.value)), '(B had it paused)');
  const bView = await B.page.evaluate(async id => { await hub.pull(); return hub.timers.list().filter(x => x.id === id).map(x => x.state); }, r.id);
  log('B now shows:', JSON.stringify(bView));
  log('mirror:', JSON.stringify((await mir()).filter(m => m.key.endsWith(':' + r.id)).map(m => m.value)));
  await A.close(); await B.close();

  log('\n## E5: two devices migrate one timer.active at once');
  await L.reset('typical');
  const now = Date.now();
  // clear Eli's timer rows, then a legacy row
  const cur = await rows('eli');
  await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [...cur.map(x => ({ key: x.key, value: null, updated_at: now })), { key: 'timer.active', value: { endAt: now + 300000, total: 300, startedAt: now }, updated_at: now + 1 }] } });
  log('server before:', JSON.stringify((await rows('eli')).filter(x => x.value).map(x => x.key)));
  const C = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const D = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const [fc, fd] = await Promise.all([C.openApp('timer', { wait: '#go' }), D.openApp('timer', { wait: '#go' })]);
  await Promise.all([fc, fd].map(f => f.waitForFunction(() => window.__timer && __timer.isLive(), null, { timeout: 20000 })));
  await sleep(1500);
  for (const f of [fc, fd]) await f.evaluate(async () => { for (let i = 0; i < 20; i++) { await hub.flush(); if (!hub.sync.pending) break; await new Promise(r => setTimeout(r, 250)); } await hub.pull(); });
  await sleep(1000);
  const s5 = (await rows('eli')).filter(x => x.value);
  log('server after:', JSON.stringify(s5.map(x => [x.key, x.value.total, x.value.startedAt === now])));
  log('mirrors:', JSON.stringify((await mir()).filter(m => m.value && m.key.startsWith('run:eli:')).map(m => m.key)));
  log('C list', JSON.stringify(await fc.evaluate(() => hub.timers.list().map(x => [x.id, x.state]))), 'D list', JSON.stringify(await fd.evaluate(() => hub.timers.list().map(x => [x.id, x.state]))));
  await C.close(); await D.close();
} catch (e) { console.error(e); } finally { await L.close(); }
