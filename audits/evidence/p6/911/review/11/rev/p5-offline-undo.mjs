// Round 2: Undo while offline (does it hang on the pull? does the count come back at once?), and the fit() cost: --room writes
// and long tasks over a 40-tap burst, and whether --room keeps changing when nothing does (a loop).
import { local, sleep } from '../../hub-audit/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const shown = f => f.evaluate(() => document.getElementById('n').textContent);
try {
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f = await A.openApp('tally', { wait: '#plus' });
  await f.waitForFunction(() => !document.getElementById('n').classList.contains('skeleton')); await sleep(800);
  console.log('start', await shown(f));
  await A.setOffline(true); await sleep(300);
  await f.locator('#reset').click(); await sleep(300);
  console.log('offline after reset', await shown(f));
  const t0 = Date.now();
  await f.locator('#hub-toast .toast-act').click();
  await f.waitForFunction(() => document.getElementById('n').textContent !== '0', null, { timeout: 30000 }).catch(() => {});
  console.log('offline Undo -> shows', await shown(f), 'after', Date.now() - t0, 'ms; toast:', await f.evaluate(() => (document.getElementById('hub-toast') || {}).textContent || ''));
  await A.setOffline(false); await f.evaluate(() => hub.flush()); await sleep(1500);
  const srv = (await L.apiAs('eli', '/api/data/tally?scope=person')).body.items.filter(i => i.key.startsWith('count:') || i.key === 'reset').map(i => i.key + '=' + JSON.stringify(i.value));
  console.log('server after reconnect', srv.join('  '));
  // fit() cost
  await f.evaluate(() => { window.__roomW = 0; const s = document.documentElement.style; const orig = s.setProperty.bind(s); s.setProperty = (k, v, p) => { if (k === '--room') window.__roomW++; return orig(k, v, p); }; window.__lt = 0; try { new PerformanceObserver(l => { window.__lt += l.getEntries().length; }).observe({ entryTypes: ['longtask'] }); } catch {} });
  for (let i = 0; i < 40; i++) await f.locator('#plus').click({ delay: 0 });
  await sleep(1500);
  const a = await f.evaluate(() => ({ roomWrites: window.__roomW, room: document.documentElement.style.getPropertyValue('--room'), n: document.getElementById('n').textContent }));
  await sleep(3000);
  const b = await f.evaluate(() => ({ roomWrites: window.__roomW, room: document.documentElement.style.getPropertyValue('--room') }));
  console.log('40 taps:', JSON.stringify(a), 'then 3 s idle:', JSON.stringify(b));
} finally { await L.close(); }
