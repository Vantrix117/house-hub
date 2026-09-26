// Batch 0b check for P3-TIMER-01 / UX-TIMER-9 with human taps. The phase 3 scripts tap with Playwright's auto-waiting
// click, which now waits until the controls enable and then lands on "Pause" (the resumed real timer) — a person's tap on
// a disabled control does nothing. Here the taps are forced (no auto-wait): what a finger does while the page says
// "Loading…". Arms (WebKit iphone-pwa, real clock, typical seed, Eli's server timer started by "another device"):
//   warm : the shell pulled the timer channel first (cache has no timer), then another device starts 15 min; the phone
//          opens Timer with timer GETs held 9 s; Start, Reset and "1 min" tapped (forced) at ~1 s and ~4 s.
//   cold : a brand-new phone (no cache), same hold and taps.
//   fail : a brand-new phone whose first two timer GETs answer 503; same taps at ~1 s; retries in 5 s.
// Expect: skeleton + "Loading…" + disabled during the hold; the server timer unchanged; after load the 15-min countdown.
//   offwarm : Timer opened once online (cache warm, no timer), back Home, then really offline (navigator.onLine false);
//             reopen Timer: Start must be live from the cache; tap Start (normal click) -> timer.active queued locally;
//             back online -> the queue flushes to the server.
//   offcold : timer GETs aborted from the start (the channel never pulled), then offline; reopen Timer: stays disabled.
// Offline arms start no server timer.
// Run: node "audits/tools/phase6/0b/timer-stale-taps.mjs" -> audits/evidence/p6/0b/timer-stale-taps.json (+ PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/0b'; fs.mkdirSync(OUT, { recursive: true });
const state = f => f.evaluate(() => ({ t: document.getElementById('t').textContent, go: document.getElementById('go').textContent,
  goDisabled: document.getElementById('go').disabled, resetDisabled: document.getElementById('reset').disabled,
  presetsDisabled: [...document.querySelectorAll('[data-s]')].every(b => b.disabled), busy: document.getElementById('dial').getAttribute('aria-busy'),
  skeleton: !!document.querySelector('#t .skeleton'), on: [...document.querySelectorAll('[data-s].on')].map(b => b.textContent) }));
const tapAll = async f => { for (const sel of ['#go', '#reset', '[data-s="60"]']) await f.locator(sel).click({ force: true, timeout: 2000 }).catch(e => 'err ' + e.message); };
const out = {};
const SOLO = process.env.SOLO === '1';
const ONLY = process.env.ARMS ? process.env.ARMS.split(',') : null;   // e.g. ARMS=offwarm,offcold
for (const arm of ['warm', 'cold', 'fail'].filter(a => !ONLY || ONLY.includes(a))) {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  const o = out[arm] = {};
  try {
    const nd = await L.newDevice({ name: 'Eli phone ' + arm, profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: nd });
    if (arm === 'warm') { await d.goto('#home'); await sleep(4000); }    // cold/fail: nothing opened yet on this phone
    const now = Date.now();
    await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: now + 900000, total: 900, startedAt: now }, updated_at: now }] } });
    const srv = async () => { const r = await L.apiAs('eli', '/api/data/timer?scope=person'); const it = (r.body.items || []).find(i => i.key === 'timer.active'); return it ? it.value : null; };
    o.serverBefore = await srv();
    let n = 0;
    await d.ctx.route(/\/api\/data\/timer\?/, async r => { n++;
      if (arm === 'fail') { if (n <= 2) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }); return r.continue().catch(() => {}); }
      await sleep(9000); r.continue().catch(() => {}); });
    const t0 = Date.now();
    if (arm === 'warm') await d.page.evaluate(() => { location.hash = '#timer'; }); else await d.goto('#timer');
    let f; for (let i = 0; i < 100 && !(f = d.frame('timer')); i++) await sleep(50);
    await f.waitForSelector('#go'); await sleep(Math.max(0, 1000 - (Date.now() - t0)));
    o.at1s = await state(f); await tapAll(f); o.after1sTaps = await state(f);
    await d.page.screenshot({ path: `${OUT}/timer-stale-taps-${arm}-loading.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    if (arm !== 'fail') { await sleep(Math.max(0, 4000 - (Date.now() - t0))); await tapAll(f); o.after4sTaps = await state(f); }
    await f.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 40000 });
    o.liveAtMs = Date.now() - t0;
    await sleep(600);
    o.afterLoad = await state(f);
    await d.page.screenshot({ path: `${OUT}/timer-stale-taps-${arm}-loaded.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    await sleep(1500);
    o.serverAfter = await srv();
    o.timerGets = n;
    o.unchanged = JSON.stringify(o.serverAfter) === JSON.stringify(o.serverBefore);
    console.log(arm, JSON.stringify(o));
  } finally { await L.close(); }
}
const queued = p => p.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('hub.queue.timer.person.')); const q = k ? JSON.parse(localStorage.getItem(k)) : {}; return q['timer.active'] ? q['timer.active'].value : null; });
const frameOf = async d => { for (let i = 0; i < 150; i++) { const f = d.frame('timer'); if (f && await f.evaluate(() => !!document.getElementById('go')).catch(() => false)) return f; await sleep(100); } throw new Error('no timer frame'); };
for (const arm of ['offwarm', 'offcold', 'wentoff'].filter(a => !ONLY || ONLY.includes(a))) {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  const o = out[arm] = {};
  try {
    const nd = await L.newDevice({ name: 'Kitchen ' + arm, profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: nd });
    const srv = async () => { const r = await L.apiAs('eli', '/api/data/timer?scope=person'); const it = (r.body.items || []).find(i => i.key === 'timer.active'); return it ? it.value : null; };
    o.serverBefore = await srv();
    if (arm === 'offcold') await d.ctx.route(/\/api\/data\/timer\?/, r => r.abort('internetdisconnected'));
    // SOLO=1 opens apps/timer.html standalone (same SDK, same localStorage) instead of inside the shell viewer
    let site = null; if (SOLO) { await d.goto(''); site = new URL(d.page.url()).origin; }
    const open = async () => { if (SOLO) { await d.page.goto(site + '/apps/timer.html'); await d.page.waitForSelector('#go'); return d.page.mainFrame(); } await d.goto('#timer'); return frameOf(d); };
    const f0 = await open(); await sleep(3000);   // offwarm: this open pulls the timer channel
    o.firstOpen = await state(f0); await f0.evaluate(() => { window.__firstOpen = 1; });
    if (!SOLO) { await d.page.evaluate(() => { location.hash = '#home'; }); await sleep(800); }
    if (arm === 'wentoff') {   // warm cache; the next open's timer pull hangs (online), then the network drops while it waits
      await d.ctx.route(/\/api\/data\/timer\?/, () => {});
      let g; if (SOLO) { await d.page.reload(); await d.page.waitForSelector('#go'); g = d.page.mainFrame(); } else { await d.page.evaluate(() => { location.hash = '#timer'; }); await sleep(1500); g = await frameOf(d); }
      await sleep(2500); o.hungOnline = await state(g);
      await d.setOffline(true); await sleep(500); o.afterWentOffline = await state(g);
      await d.page.screenshot({ path: `${OUT}/timer-stale-taps-wentoff-after-offline.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
      console.log(arm, JSON.stringify(o)); continue;
    }
    await d.setOffline(true);
    o.cache = await d.page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('hub.cache.timer.person.')); const c = k && JSON.parse(localStorage.getItem(k)); return c ? { since: c.since, keys: Object.keys(c.items) } : null; });
    let f; if (SOLO) { await d.page.reload(); await d.page.waitForSelector('#go'); f = d.page.mainFrame(); } else { await d.page.evaluate(() => { location.hash = '#timer'; }); await sleep(1500); f = await frameOf(d); }
    await sleep(2500);
    o.reloadedFrame = await f.evaluate(() => !window.__firstOpen);
    o.onLine = await f.evaluate(() => navigator.onLine);
    o.offline = await state(f);
    await d.page.screenshot({ path: `${OUT}/timer-stale-taps-${arm}-offline.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    if (arm === 'offwarm') {
      await f.locator('#go').click({ timeout: 3000 }); await sleep(800);
      o.afterStart = await state(f); o.queuedTimerActive = await queued(d.page); o.serverWhileOffline = await srv();
      await d.page.screenshot({ path: `${OUT}/timer-stale-taps-${arm}-started.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
      await d.setOffline(false); await sleep(4000);
      o.afterOnline = await state(f); o.queuedAfterOnline = await queued(d.page); o.serverAfterOnline = await srv();
    } else {
      await f.locator('#go').click({ force: true, timeout: 2000 }).catch(() => {}); await sleep(500);
      o.afterForcedTap = await state(f); o.queuedTimerActive = await queued(d.page); o.serverAfter = await srv();
    }
    console.log(arm, JSON.stringify(o));
  } finally { await L.close(); }
}
fs.writeFileSync(`${OUT}/timer-stale-taps${ONLY ? "-" + ONLY.join("-") : ""}${SOLO ? "-solo" : ""}.json`, JSON.stringify(out, null, 1));
