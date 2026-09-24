// Skeptic 2 for "lww-absolute-count-loses-increments": two devices signed in as Eli count on the one person-scope row
// app_data(person,'tally','count'). tally.html:152-154 writes the absolute n()+1; hub.js / worker data.js keep the newest stamp.
// Run on the REAL clock and in CHROMIUM (to rule out the demo clock and WebKit as causes), no service-worker, no stubs involved.
//   A   both open; phone +5, iPad +3 two seconds later (no pull in between)         expected start+8
//   A0  control: same, but the iPad pulls (hub.pull()) before it taps               expected start+8
//   C   both offline: phone +4, iPad +2; phone reconnects first                     expected start+6
// Usage: node "audits/tools/phase3/tally/verify-lww-absolute-count-loses-increments-2.mjs" [engine=chromium|webkit]
// Writes audits/evidence/p3/tally/verify-lww-absolute-count-loses-increments-2.json (+ one PNG of the phone after A).
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const engine = process.argv[2] || 'chromium';
const L = await local({ variant: 'typical', clock: 'real', engine });
const res = { engine, clock: 'real' };
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
const shown = f => f.evaluate(() => document.getElementById('n').textContent);
const ready = f => f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
const tap = async (f, n) => { for (let i = 0; i < n; i++) await f.locator('#plus').click(); };
const toasts = f => f.evaluate(() => [...document.querySelectorAll('.toast,[role=status],[role=alert]')].map(e => e.textContent.trim()).filter(Boolean));
async function pair(tag) {
  const d = await L.newDevice({ name: 'Eli phone ' + tag, profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: d });
  const fi = await ipad.openApp('tally'); await ready(fi);
  const fp = await phone.openApp('tally'); await ready(fp);
  await sleep(1000);
  return { ipad, phone, fi, fp };
}
try {
  for (const pullFirst of [false, true]) {
    const { ipad, phone, fi, fp } = await pair(pullFirst ? 'A0' : 'A');
    const start = await server();
    await tap(fp, 5); await sleep(2000);
    const afterPhone = await server();
    if (pullFirst) await fi.evaluate(() => hub.pull());
    const ipadShownBeforeTap = await shown(fi);
    await tap(fi, 3); await sleep(2000);
    const afterIpad = await server();
    const phoneShownBeforePoll = await shown(fp);
    const r = { start, afterPhone, ipadShownBeforeTap, afterIpad, expected: start + 8, lost: start + 8 - afterIpad, phoneShownBeforePoll };
    if (!pullFirst) {
      await sleep(31500);                                   // the app's own 30 s poll (hub.js:342), no forced pull
      r.phoneShownAfterPoll = await shown(fp);
      r.phoneSync = (await phone.hub(fp)).sync;
      r.phoneToasts = await toasts(fp).catch(() => []);
      await phone.page.screenshot({ path: `${OUT}/verify-lww-absolute-count-loses-increments-2-A-phone.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    }
    res[pullFirst ? 'A0' : 'A'] = r;
    console.log(pullFirst ? 'A0' : 'A', JSON.stringify(r));
    await ipad.close(); await phone.close();
    await L.reset('typical');
  }
  {
    const { ipad, phone, fi, fp } = await pair('C');
    const start = await server();
    await phone.setOffline(true); await ipad.setOffline(true);
    await tap(fp, 4); await sleep(300); await tap(fi, 2);
    const offline = { phone: await shown(fp), ipad: await shown(fi), server: await server() };
    await phone.setOffline(false); await sleep(3000);
    const afterPhoneOnline = await server();
    await ipad.setOffline(false); await sleep(3000);
    const r = { start, offline, afterPhoneOnline, serverEnd: await server(), expected: start + 6, lost: start + 6 - (await server()), ipadShows: await shown(fi) };
    await fp.evaluate(() => hub.pull()); r.phoneShowsAfterPull = await shown(fp);
    res.C = r; console.log('C', JSON.stringify(r));
    await ipad.close(); await phone.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/verify-lww-absolute-count-loses-increments-2.json`, JSON.stringify(res, null, 1));
  await L.close();
}
