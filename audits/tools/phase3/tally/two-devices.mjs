// Two devices of the same person (Eli: the Kitchen iPad and his phone) counting on the one person-scope row
// app_data(person,'tally','count'). tally.html:152-154 writes the ABSOLUTE value n()+1 from the device's own copy, and
// hub.js resolves by updated_at (last write wins, hub.js:227-238 / worker data.js), so increments made on the other
// device since this device last pulled are overwritten.
//   A  both open, phone taps +5, iPad taps +3 a few seconds later (before its 30 s poll)       expected 45
//   B  iPad had Tally open earlier (cache 37); phone counts +13; iPad reopens Tally on a slow link
//      (its GET held 1.5 s) and taps + once at ~400 ms                                        expected 51
//   B0 control for B without the hold                                                         expected 51
//   C  both offline: phone +4, iPad +2; phone reconnects first, then the iPad                   expected 43
// Run: node "audits/tools/phase3/tally/two-devices.mjs"   -> audits/evidence/p3/tally/two-devices.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
const shown = f => f.evaluate(() => document.getElementById('n').textContent);
const ready = f => f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
const tap = async (f, n, sel = '#plus') => { for (let i = 0; i < n; i++) await f.locator(sel).click(); };
try {
  const phDev = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  // ── A ──
  {
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: phDev });
    const fi = await ipad.openApp('tally'); await ready(fi);
    const fp = await phone.openApp('tally'); await ready(fp);
    const start = await server();
    await tap(fp, 5); await sleep(1500);
    const afterPhone = await server();
    await tap(fi, 3); await sleep(1500);
    const afterIpad = await server();
    await sleep(31000);                       // both apps' own 30 s poll (hub.js:342)
    res.A = { start, afterPhone, afterIpad, expected: start + 8, lost: start + 8 - afterIpad, phoneShowsAfterPoll: await shown(fp), ipadShows: await shown(fi) };
    console.log('A', JSON.stringify(res.A));
    await ipad.close(); await phone.close();
  }
  await L.reset('typical');
  // ── B / B0 ──
  for (const hold of [1500, 0]) {
    const phDev2 = await L.newDevice({ name: 'Eli phone ' + hold, profiles: ['eli'] });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: phDev2 });
    let fi = await ipad.openApp('tally'); await ready(fi); const cached = await shown(fi);
    await ipad.goto('#home'); await sleep(500);                       // closes the viewer; the tally cache stays in localStorage
    const fp = await phone.openApp('tally'); await ready(fp);
    await tap(fp, 13); await sleep(1500);
    const afterPhone = await server();
    let heldGets = 0;
    if (hold) await ipad.ctx.route(u => u.href.includes('/api/data/tally?'), async r => { heldGets++; await sleep(hold); r.continue().catch(() => {}); });
    const t0 = Date.now();
    fi = await ipad.openApp('tally'); await ready(fi);
    const shownAtOpen = await shown(fi);
    await sleep(Math.max(0, 400 - (Date.now() - t0)));
    await fi.locator('#plus').click(); const tapAt = Date.now() - t0;
    await sleep(hold + 2500);
    const key = hold ? 'B' : 'B0';
    res[key] = { cachedOnIpad: cached, afterPhone, ipadShowedAtOpen: shownAtOpen, tapAtMs: tapAt, heldGets, serverEnd: await server(), ipadShowsEnd: await shown(fi), expected: afterPhone + 1 };
    console.log(key, JSON.stringify(res[key]));
    await ipad.goto('#home');
    await ipad.close(); await phone.close();
    await L.reset('typical');
  }
  // ── C ──
  {
    const phDev3 = await L.newDevice({ name: 'Eli phone C', profiles: ['eli'] });
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: phDev3 });
    const fi = await ipad.openApp('tally'); await ready(fi);
    const fp = await phone.openApp('tally'); await ready(fp);
    const start = await server();
    await phone.setOffline(true); await ipad.setOffline(true);
    await tap(fp, 4); await sleep(300); await tap(fi, 2);
    const offlineShown = { phone: await shown(fp), ipad: await shown(fi), server: await server() };
    await phone.setOffline(false); await sleep(2500);
    const afterPhoneOnline = await server();
    await ipad.setOffline(false); await sleep(2500);
    res.C = { start, offlineShown, afterPhoneOnline, serverEnd: await server(), ipadShows: await shown(fi), expected: start + 6 };
    await sleep(31000);
    res.C.phoneShowsAfterPoll = await shown(fp);
    console.log('C', JSON.stringify(res.C));
  }
} finally {
  fs.writeFileSync(`${OUT}/two-devices.json`, JSON.stringify(res, null, 1));
  await L.close();
}
