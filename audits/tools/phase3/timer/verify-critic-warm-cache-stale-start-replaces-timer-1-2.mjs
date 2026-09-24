// Skeptic #2 for critic-warm-cache-stale-start-replaces-timer-1 (intent/context lens).
// Question: with a WARM timer cache (the phone has pulled before), can a person's own timer started on the Kitchen iPad
// (through the Timer UI, not the API) be replaced by one Start tap on the phone, when the phone's timer pulls are only
// moderately slow (3 s latency, not a 9 s hold), and the tap comes at a human pace (~1.2 s after opening)?
// Modes: 'lat3' = every /api/data/timer GET on the phone delayed 3 s; 'ctrl' = no delay.
// Run: node "audits/tools/phase3/timer/verify-critic-warm-cache-stale-start-replaces-timer-1-2.mjs"
//   -> audits/evidence/p3/timer/verify-critic-warm-cache-stale-start-replaces-timer-1-2.json (+ PNGs)
import { local, sleep } from '../../lib/local.mjs';
import { save, shot, appState, serverTimer, pillState } from './_util.mjs';
const PFX = 'verify-critic-warm-cache-stale-start-replaces-timer-1-2';
const out = {};
for (const mode of ['lat3', 'ctrl']) {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  const o = out[mode] = {};
  try {
    const nd = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: nd });
    await phone.goto('#home'); await sleep(4000);
    o.phoneCacheWarm = await phone.page.evaluate(() => { const c = JSON.parse(localStorage.getItem('hub.cache.timer.person.eli') || 'null'); return c && { since: c.since, keys: Object.keys(c.items) }; });
    // Eli starts a 15-minute timer on the Kitchen iPad through the Timer UI.
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await ipad.goto('#home'); const fi = await ipad.openApp('timer');
    await fi.click('[data-s="900"]'); await fi.click('#go'); await sleep(2500);
    o.ipadAfterStart = await appState(fi);
    o.serverBefore = await serverTimer(L, 'eli');
    // Phone: slow timer pulls (a sluggish network after unlocking), then open the Timer tile.
    let delayed = 0;
    if (mode === 'lat3') await phone.ctx.route(/\/api\/data\/timer\?/, async r => { delayed++; await sleep(3000); await r.continue().catch(() => {}); });
    const t0 = Date.now();
    await phone.page.evaluate(() => { location.hash = '#timer'; });
    let f; for (let i = 0; i < 100 && !(f = phone.frame('timer')); i++) await sleep(50);
    await f.waitForSelector('#go');
    let live = null; for (let i = 0; i < 200; i++) { if (await f.evaluate(() => typeof document.getElementById('go').onclick === 'function').catch(() => false)) { live = Date.now() - t0; break; } await sleep(25); }
    o.handlerLiveMs = live;
    const wait = Math.max(0, 1200 - (Date.now() - t0)); await sleep(wait);
    o.beforeTap = await appState(f); o.beforeTapPill = await pillState(phone.page).catch(e => String(e));
    o.beforeTapMs = Date.now() - t0;
    o.beforeTapShot = await shot(phone.page, `${PFX}-${mode}-phone-before-tap.png`);
    if (mode === 'lat3') {
      await f.click('#go'); o.tapAtMs = Date.now() - t0; await sleep(500); o.afterTap = await appState(f);
    }
    await sleep(6000);
    o.phoneAfterPulls = await appState(f);
    o.serverAfter = await serverTimer(L, 'eli');
    await fi.evaluate(() => hub.pull()).catch(() => {}); await sleep(1500);
    o.ipadAfter = await appState(fi);
    o.ipadAfterShot = await shot(ipad.page, `${PFX}-${mode}-ipad-after.png`);
    o.delayedRequests = delayed;
    o.replaced = !!(o.serverAfter['timer.active'] && o.serverBefore['timer.active'] && o.serverAfter['timer.active'].total !== o.serverBefore['timer.active'].total);
  } finally { await L.close(); }
}
console.log(JSON.stringify(out, null, 1));
console.log('saved', save(`${PFX}.json`, out));
