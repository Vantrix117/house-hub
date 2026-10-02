// E9: storage full. A dead document's queued row is adopted; this document cannot save it (quota), keeps it in memory only,
// and deletes the dead key anyway. If the send then fails and the page goes away, the row is lost.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  await L.reset('typical');
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); const A = d.page;
  await A.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && hub.isLoaded('timer', 'person'), null, { timeout: 30000 });
  await A.evaluate(() => { localStorage.setItem('hub.queue.timer.person.eli.deaddoc1', JSON.stringify({ zzD: { value: 'kept?', updated_at: Date.now() } })); });
  const filled = await A.evaluate(() => { let n = 0; for (let size = 1 << 20; size >= 1; size = size >> 1) { for (;;) { try { localStorage.setItem('zzjunk' + n, 'x'.repeat(size)); n++; } catch { break; } } } return n; });
  const api = u => u.href.startsWith(L.api); await d.ctx.route(api, r => r.abort('connectionrefused'));   // the house cannot be reached; navigator.onLine stays true
  await A.evaluate(() => hub.flush()); await sleep(800);
  const st = await A.evaluate(() => ({ keys: Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')), mem: hub.sync.pending, err: hub.sync.lastError }));
  console.log('junk keys', filled, '| after a failed send: queue keys on disk', JSON.stringify(st.keys), 'pending (memory)', st.mem, 'lastError', st.err);
  await A.reload(); await sleep(2500);
  const st2 = await A.evaluate(() => ({ keys: Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => [k, localStorage.getItem(k)]), pend: hub.sync.pending }));
  console.log('after the page reloads: queue keys', JSON.stringify(st2.keys), 'pending', st2.pend);
  await A.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('zzjunk')) localStorage.removeItem(k); });
  await d.ctx.unroute(api); await A.reload(); await sleep(3000); await A.evaluate(() => hub.flush()); await sleep(1500);
  const srv = (((await L.apiAs('eli', '/api/data/timer?scope=person')).body.items) || []).find(i => i.key === 'zzD');
  console.log('house has zzD:', JSON.stringify(srv ? srv.value : null));
} catch (e) { console.error(e); } finally { await L.close(); }
