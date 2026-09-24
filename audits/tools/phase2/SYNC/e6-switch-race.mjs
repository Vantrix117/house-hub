// SYNC e6 — a pull that is in flight when someone switches profile on the shared iPad is not cancelled by hub.reset().
//   node "audits/tools/phase2/SYNC/e6-switch-race.mjs"
// hub.reset() (apps/hub.js:370) clears the in-memory store but not the in-flight `pulling` promise; the next hub.ready()'s pull()
// returns that same promise (apps/hub.js:305).
//  A. slow RESPONSE: the old person's rows arrive after the switch; pullScope re-reads the cache with the NEW pid() (refreshScope,
//     apps/hub.js:190-195, 291) and saves the old person's rows under the new person's key (apps/hub.js:297-301).
//  B. slow REQUEST: it reaches the Worker after Me → Switch logged the old session out → 401 → handleAuthLoss (apps/hub.js:147-155)
//     clears the NEW person's session and shows the picker.
// Setup: Eli's phone starts a 10-minute kitchen timer (Eli's person scope). The Kitchen iPad (Eli) comes back to the foreground,
// which starts a pull; its timer request takes 4 s (a weak Wi-Fi moment). Meanwhile Ezra taps Me → Switch → Ezra.
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, writeEvidence, setHidden } from './_util.mjs';

async function run(mode) {
  const r = { mode };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const reader = await L.newDevice({ name: 'Audit reader', profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    for (const d of [phone, ipad]) { await d.goto('#home'); await waitFor(() => d.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); }
    await ipad.page.evaluate(() => { location.hash = '#me'; }); await sleep(500);
    await setHidden(ipad.page, true);
    await phone.page.evaluate(() => { const now = Date.now(); hub.set('timer.active', { endAt: now + 600000, total: 600, startedAt: now }, { app: 'timer', scope: 'person' }); });
    await sleep(1500);
    let slow = true;
    await ipad.ctx.route(/\/api\/data\/timer\?/, async route => {
      if (!(slow && route.request().method() === 'GET')) return route.continue().catch(() => {});
      slow = false;
      if (mode === 'slow-response') { const res = await route.fetch(); await sleep(4000); return route.fulfill({ response: res }).catch(() => {}); }
      await sleep(4000); return route.continue().catch(() => {});
    });
    await setHidden(ipad.page, false);                                  // iPad wakes: visibilitychange → hub.pull()
    await sleep(300);
    await ipad.page.click('#switch');
    await ipad.page.waitForSelector('.pcard[data-id="ezra"]', { timeout: 10000 });
    await ipad.page.click('.pcard[data-id="ezra"]');
    await waitFor(() => ipad.page.evaluate(() => hub.profile && hub.profile.id === 'ezra'), { timeout: 10000 });
    r.ezraSignedInBeforeSlowReply = true;
    await sleep(6000);
    r.after = await ipad.page.evaluate(() => ({ profile: hub.profile && hub.profile.id, onPicker: !document.getElementById('gate').hidden, pickMsg: (document.getElementById('pickmsg') || {}).textContent || null,
      ezraTimerCache: (() => { try { const c = JSON.parse(localStorage.getItem('hub.cache.timer.person.ezra')); return c ? Object.fromEntries(Object.entries(c.items).map(([k, v]) => [k, v.v])) : null; } catch { return null; } })() }));
    if (!r.after.onPicker) { await ipad.page.click('.tab[data-tab="home"]'); await sleep(800); r.pill = await ipad.page.evaluate(() => ({ visible: !document.getElementById('timer-pill').hidden, time: document.getElementById('timer-pill-time').textContent })); }
    r.ezraServerTimerRows = (await L.apiAs(null, '/api/data/timer?scope=person', { deviceToken: reader.device.token, profileToken: reader.sessions.ezra })).body.items.map(i => i.key);
    r.shot = await shot(ipad.page, `e6-${mode}-ipad.png`);
    log(`[${mode}] 6 s after Ezra signed in: profile ${r.after.profile}, picker shown ${r.after.onPicker} ${r.after.pickMsg ? '("' + r.after.pickMsg + '")' : ''}; Ezra's timer cache on this iPad ${JSON.stringify(r.after.ezraTimerCache)}; Ezra's timer rows on the server ${JSON.stringify(r.ezraServerTimerRows)}; timer pill on Ezra's Home ${JSON.stringify(r.pill || null)}`);
  } finally { await L.close(); }
  return r;
}
const out = { A: await run('slow-response'), B: await run('slow-request') };
log('evidence', writeEvidence('e6-switch-race.json', out));
