// Date/time edge cases for the Kitchen timer (local rig, Chromium, typical seed, real server clock).
//  Z1 midnight: browser clock installed at 23:58:30 New York (2026-09-24), 5-min timer started through the UI, run across 00:00
//  Z2 DST fall-back: browser clock at 01:55 EDT on 2026-11-01 (05:55Z); 10-min timer run across 02:00 EDT -> 01:00 EST
//  Z3 another time zone: the same person's second device with its timezone overridden to Asia/Tokyo (CDP), shows the same time left
//  A1 AudioContext use: 6 finishes in one page life (timer written 1.5 s ahead each time and pulled): contexts made vs closed
// Note: the browser clock is moved away from the server's clock in Z1/Z2; hub.skew (apps/hub.js:290) only affects write stamps.
// Run: node "audits/tools/phase3/timer/clocktz.mjs"   Output: audits/evidence/p3/timer/clocktz.json
import { local, sleep } from '../../lib/local.mjs';
import { save, appState, audioProbe } from './_util.mjs';
import { contextOptions } from '../../lib/devices.mjs';
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
// Z1, Z2 and A1 open apps/timer.html standalone (one document). Rig caveat found while writing this script: with a fake clock,
// clock.runFor advances the shell page and the app iframe one after the other, so near 0 the shell can finish (and clear
// timer.active) while the iframe's clock still reads ~2 s before the end; the app then takes the "cleared elsewhere" branch
// (apps/timer.html:135) and resets without a beep. Real clocks do not do this, so the end of a run is only judged standalone.
async function timerDevice(at, opts = {}) {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: at, ...opts });
  await audioProbe(d.ctx);
  await d.page.goto(L.site + '/apps/timer.html'); await d.page.waitForFunction(() => window.hub && hub.profile && document.getElementById('go'));
  await d.ctx.clock.runFor(1500); return { d, f: d.page.mainFrame() };
}
const local_ = f => f.evaluate(() => new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }));
try {
  { const { d, f } = await timerDevice(Date.parse('2026-09-24T23:58:30-04:00'));
    await f.click('[data-s="300"]'); await f.click('#go'); await d.ctx.clock.runFor(1000);
    const a = { at: await local_(f), ...(await appState(f)) };
    await d.ctx.clock.runFor(120000); const b = { at: await local_(f), ...(await appState(f)) };
    await d.ctx.clock.runFor(180000); const c = { at: await local_(f), ...(await appState(f)) };
    out.Z1_midnight = { a, b, c }; await d.close(); }
  { const { d, f } = await timerDevice(Date.parse('2026-11-01T05:55:00Z'));
    await f.click('[data-s="600"]'); await f.click('#go'); await d.ctx.clock.runFor(1000);
    const a = { at: await local_(f), ...(await appState(f)) };
    await d.ctx.clock.runFor(420000); const b = { at: await local_(f), ...(await appState(f)) };
    await d.ctx.clock.runFor(185000); const c = { at: await local_(f), ...(await appState(f)) };
    out.Z2_dst = { a, b, c }; await d.close(); }
  { const now = Date.now();
    const ph = await L.newDevice({ name: 'Eli travel laptop', profiles: ['eli'] });
    const ny = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    const f1 = await ny.openApp('timer', { wait: '#go' }); await sleep(1200);
    await f1.click('[data-s="900"]'); await f1.click('#go'); await sleep(1500);
    // a context of its own with timezoneId Asia/Tokyo, signed in on Eli's second paired device (same keys the harness writes)
    const me = await (await fetch(L.api + '/api/me', { headers: { 'X-Device-Token': ph.device.token, 'X-Profile-Token': ph.sessions.eli } })).json();
    const tctx = await L.browser.newContext({ ...contextOptions('desktop', 'light'), timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' });
    await tctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
    await tctx.addInitScript(c => { if (location.origin === c.site && !localStorage.getItem('rig.init')) { localStorage.clear(); localStorage.setItem('hub.api', JSON.stringify(c.api)); localStorage.setItem('hub.device', JSON.stringify(c.device)); localStorage.setItem('hub.session', JSON.stringify(c.session)); localStorage.setItem('hub.profiles', JSON.stringify(c.profiles)); localStorage.setItem('hub.lastProfile', JSON.stringify('eli')); localStorage.setItem('rig.init', '1'); } },
      { site: L.site, api: L.api, device: ph.device, session: { token: ph.sessions.eli, profile: me.profile }, profiles: L.S.profiles });
    const tpage = await tctx.newPage(); await tpage.goto(L.site + '/index.html#timer');
    let f2; for (let i = 0; i < 80 && !(f2 = tpage.frames().find(x => x.url().includes('/apps/timer.html'))); i++) await sleep(100);
    await f2.waitForFunction(() => window.hub && document.getElementById('go')); await sleep(2500);
    const tk = { close: () => tctx.close() };
    out.Z3_tokyo = { tokyoZone: await f2.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone), ny: await appState(f1), tokyo: await appState(f2) };
    await f1.click('#reset'); await sleep(800); await ny.close(); await tk.close(); }
  { const { d, f } = await timerDevice(Date.now());
    for (let i = 0; i < 6; i++) {
      const now = await f.evaluate(() => Date.now());
      await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: now + 1500, total: 60, startedAt: now - 58500 }, updated_at: Date.now() + i } ] } });
      await f.evaluate(() => hub.pull()); await d.ctx.clock.runFor(300); await sleep(300); await d.ctx.clock.runFor(2500);
    }
    out.A1_audio = { app: await appState(f), liveContexts: await f.evaluate(() => window.__audio.made - window.__audio.closed) };
    await d.close(); }
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('clocktz.json', out));
