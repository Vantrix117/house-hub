// Skeptic 2 for "first-load-tap-overwrites-count": does one tap on Tally during a slow or failed FIRST pull
// (no tally cache on the device) replace the saved count on the server?
// Modes (each on a freshly reset 'typical' DB and a newly paired device, WebKit iphone-pwa):
//   hold10     GET /api/data/tally held 10 s; tap + as soon as the app has painted          (claim: 37 -> 1)
//   neterr     GET aborted as a network error for the first 8 s; tap +                     (a different failure than 503)
//   minus      GET held 10 s; tap −                                                         (claim: -> 0)
//   kid        as Ezra (a kid, Tally's main users), GET held 10 s; tap +
//   latetap    GET held 10 s, but tap only after the held GET has answered                  (control: +1)
// After hold10, a second device (the rig's Kitchen iPad, its own fresh context) opens Tally and reports what it shows.
// Run: node "audits/tools/phase3/tally/verify-first-load-tap-overwrites-count-2.mjs"
//   -> audits/evidence/p3/tally/verify-first-load-tap-overwrites-count-2.json (+ -hold10-at-tap.png, -hold10-ipad-after.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const PFX = `${OUT}/verify-first-load-tap-overwrites-count-2`;
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async who => { const r = await L.apiAs(who, '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? { value: it.value, updated_at: it.updated_at } : null; };
try {
  for (const mode of ['hold10', 'neterr', 'minus', 'kid', 'latetap']) {
    await L.reset('typical');
    const who = mode === 'kid' ? 'ezra' : 'eli';
    const dev = await L.newDevice({ name: 'Skeptic2 ' + mode, profiles: [who] });
    const phone = await L.device({ device: 'iphone-pwa', profile: who, fixedTime: false, as: dev });
    const t0 = Date.now(); const gets = [];
    await phone.ctx.route(u => u.href.includes('/api/data/tally?'), async r => {
      const at = Date.now() - t0; gets.push(at);
      if (mode === 'neterr') { if (at < 8000) return r.abort('internetdisconnected'); return r.continue(); }
      if (gets.length === 1) await sleep(10000);
      r.continue().catch(() => {});
    });
    const before = await server(who);
    const f = await phone.openApp('tally');
    await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 20000 });
    const readyAt = Date.now() - t0;
    const atReady = await f.evaluate(() => ({ shown: document.getElementById('n').textContent, plusDisabled: document.getElementById('plus').disabled, sync: { ...hub.sync }, cacheKeys: Object.keys(localStorage).filter(k => k.includes('tally')) }));
    if (mode === 'latetap') await sleep(Math.max(0, 11000 - (Date.now() - t0)));
    const shownBeforeTap = await f.evaluate(() => document.getElementById('n').textContent);
    await f.locator(mode === 'minus' ? '#minus' : '#plus').click();
    const tapAt = Date.now() - t0;
    const shownAfterTap = await f.evaluate(() => document.getElementById('n').textContent);
    if (mode === 'hold10') await phone.page.screenshot({ path: `${PFX}-hold10-at-tap.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    await sleep(Math.max(3000, 14000 - (Date.now() - t0)));   // held/failed GET has answered; the 30 s poll has not fired
    const after = await server(who);
    const shownEnd = await f.evaluate(() => document.getElementById('n').textContent);
    const r = { who, serverBefore: before, readyAtMs: readyAt, atReady, shownBeforeTap, tapAtMs: tapAt, shownAfterTap, tallyGetsAtMs: gets, serverAfter: after, shownEnd };
    if (mode === 'hold10') {
      const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
      const g = await ipad.openApp('tally');
      await g.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 20000 });
      await sleep(1500);
      r.secondDeviceShows = await g.evaluate(() => document.getElementById('n').textContent);
      await ipad.page.screenshot({ path: `${PFX}-hold10-ipad-after.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
      await ipad.close();
    }
    res[mode] = r;
    console.log(mode, JSON.stringify(r));
    await phone.close();
  }
} finally {
  fs.writeFileSync(`${PFX}.json`, JSON.stringify(res, null, 1));
  await L.close();
}
