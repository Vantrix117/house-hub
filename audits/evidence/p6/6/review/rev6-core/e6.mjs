// E6: a timer kept on a device (P2-PROF-08) that is then signed in as the TV display: does the kiosk board get the pill?
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  await L.reset('typical');
  const now = Date.now(), row = { id: 'k1', label: 'roast', total: 20000, startedAt: now, endAt: now + 20000, pausedAt: null, remaining: null, by: 'eli', ackAt: null };
  await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer:k1', value: row, updated_at: now }] } });
  await L.apiAs('eli', '/api/data/timer/batch?scope=family', { method: 'POST', body: { items: [{ key: 'run:eli:k1', value: { label: 'roast', total: 20000, endAt: row.endAt, pausedAt: null, remaining: null, by: 'eli', startedAt: now }, updated_at: now }] } });
  const T = await L.device({ device: 'tv', profile: 'tv', fixedTime: false, localStorage: { 'hub.timers.device': [{ owner: 'eli', name: 'Eli', hue: 'sky', emoji: '', sound: 'chime', row }] } }).catch(async () => L.device({ device: 'desktop-1440', profile: 'tv', fixedTime: false, localStorage: { 'hub.timers.device': [{ owner: 'eli', name: 'Eli', hue: 'sky', emoji: '', sound: 'chime', row }] } }));
  await T.goto('#home'); await T.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 30000 }); await sleep(2500);
  const st = () => T.page.evaluate(() => { const p = document.getElementById('timer-pill'); const b = p.getBoundingClientRect(); return { kind: hub.profile && hub.profile.kind, pillHidden: p.hidden, display: getComputedStyle(p).display, label: document.getElementById('timer-pill-label').textContent, time: document.getElementById('timer-pill-time').textContent, rect: [b.x, b.y, b.width, b.height].map(Math.round), tvLine: (document.querySelector('.tv-timers') || {}).textContent || null, rings: window.__timerShell && window.__timerShell.rings }; });
  console.log('running:', JSON.stringify(await st()));
  await T.shot('C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev6-core/e6-tv-running.png');
  await sleep(21000);
  console.log('ended:', JSON.stringify(await st()));
  await T.shot('C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev6-core/e6-tv-ended.png');
} catch (e) { console.error(e); } finally { await L.close(); }
