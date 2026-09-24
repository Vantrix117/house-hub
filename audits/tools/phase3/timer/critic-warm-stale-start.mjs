// Completeness critic: does P3-TIMER-01 need a cold cache? Eli's phone has pulled before (warm cache, no timer). Eli then
// starts a 15-minute timer on another device (written through the API as that device). The phone opens the Kitchen
// timer while its timer pulls are held for 9 s (a slow network after unlocking). Does the app show an idle 5:00 with a
// live Start at once (hub.ready does not wait when the cache has been seen, apps/hub.js:335-337), and does one Start
// replace the running 15-minute timer on the server?  Mode 'ctrl' = no hold.
// Run: node "audits/tools/phase3/timer/critic-warm-stale-start.mjs"  -> audits/evidence/p3/timer/critic-warm-stale-start.json
import { local, sleep } from '../../lib/local.mjs';
import { save, shot, appState, serverTimer } from './_util.mjs';
const out = {};
for (const mode of ['hold', 'ctrl']) {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  const o = out[mode] = {};
  try {
    const nd = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: nd });
    await d.goto('#home'); await sleep(4000);                           // warm: the shell has pulled the timer channel
    o.warmCache = await d.page.evaluate(() => { const c = JSON.parse(localStorage.getItem('hub.cache.timer.person.eli') || 'null'); return c && { since: c.since, keys: Object.keys(c.items) }; });
    const now = Date.now();
    const w = await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: now + 900000, total: 900, startedAt: now }, updated_at: now }] } });
    o.otherDeviceStart = w.status;
    o.serverBefore = await serverTimer(L, 'eli');
    let held = 0;
    if (mode === 'hold') await d.ctx.route(/\/api\/data\/timer\?/, async r => { held++; await sleep(9000); await r.continue().catch(() => {}); });
    const t0 = Date.now();
    await d.page.evaluate(() => { location.hash = '#timer'; });           // tile tap equivalent: the shell stays loaded
    let f; for (let i = 0; i < 100 && !(f = d.frame('timer')); i++) await sleep(50);
    await f.waitForSelector('#go');
    let live = null; for (let i = 0; i < 200; i++) { if (await f.evaluate(() => typeof document.getElementById('go').onclick === 'function').catch(() => false)) { live = Date.now() - t0; break; } await sleep(50); }
    o.handlerLiveMs = live;
    o.beforeTap = await appState(f);
    o.beforeTapShot = await shot(d.page, `critic-warm-stale-${mode}-before-tap.png`);
    if (mode === 'hold') { await f.click('#go'); o.tapAtMs = Date.now() - t0; await sleep(600); o.afterTap = await appState(f); }
    await sleep(mode === 'hold' ? 12000 : 2000);
    await f.evaluate(() => hub.pull()).catch(() => {}); await sleep(1500);
    o.afterPulls = await appState(f);
    o.serverAfter = await serverTimer(L, 'eli');
    o.held = held;
  } finally { await L.close(); }
}
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('critic-warm-stale-start.json', out));
