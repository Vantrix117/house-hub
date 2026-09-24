// Skeptic #1 for "lww-absolute-count-loses-increments" (Tally): does a tap on one device of the same person overwrite
// the taps made on the other device since it last pulled? Independent re-run, minimal.
//   A  both devices have Tally open; phone taps + x5 (flushed), then the iPad taps + x3 before its 30 s poll.
//      Expected (if increments added up): start+8. Then wait for the 30 s poll and read what the phone shows.
//   C  both offline: phone + x4, iPad + x2; phone reconnects first, then the iPad. Expected start+6.
//   K  control: the iPad pulls (hub.pull in its frame) before tapping — shows the loss needs a stale copy.
// Run: node "audits/tools/phase3/tally/verify-lww-absolute-count-loses-increments-1.mjs"
//   -> audits/evidence/p3/tally/verify-lww-absolute-count-loses-increments-1.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally/verify-lww-absolute-count-loses-increments-1.json';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? { value: it.value, updated_at: it.updated_at } : null; };
const shown = f => f.evaluate(() => document.getElementById('n').textContent);
const ready = f => f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 10000 });
const tap = async (f, n) => { for (let i = 0; i < n; i++) await f.locator('#plus').click(); };
const pair = async tag => {
  const ph = await L.newDevice({ name: 'Verify phone ' + tag, profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const fi = await ipad.openApp('tally'); await ready(fi);
  const fp = await phone.openApp('tally'); await ready(fp);
  return { ipad, phone, fi, fp };
};
try {
  { // A
    const { ipad, phone, fi, fp } = await pair('A');
    const start = (await server())?.value ?? 0;
    const ipadBefore = await shown(fi);
    await tap(fp, 5); await sleep(1500);
    const afterPhone = await server();
    const ipadStillShows = await shown(fi);
    await tap(fi, 3); await sleep(1500);
    const afterIpad = await server();
    const phoneRightAfter = await shown(fp);
    await sleep(32000);
    res.A = { start, ipadBefore, afterPhone, ipadStillShowsBeforeTap: ipadStillShows, afterIpad, expected: start + 8, lost: start + 8 - afterIpad.value, phoneRightAfter, phoneAfterPoll: await shown(fp), ipadEnd: await shown(fi) };
    console.log('A', JSON.stringify(res.A));
    await ipad.close(); await phone.close();
  }
  await L.reset('typical');
  { // C
    const { ipad, phone, fi, fp } = await pair('C');
    const start = (await server())?.value ?? 0;
    await phone.setOffline(true); await ipad.setOffline(true);
    await tap(fp, 4); await tap(fi, 2);
    const offline = { phone: await shown(fp), ipad: await shown(fi), server: (await server()).value };
    await phone.setOffline(false); await sleep(3000);
    const afterPhoneOnline = (await server()).value;
    await ipad.setOffline(false); await sleep(3000);
    const end = (await server()).value;
    await fp.evaluate(() => hub.pull()); await sleep(500);
    res.C = { start, offline, afterPhoneOnline, serverEnd: end, expected: start + 6, lost: start + 6 - end, phoneAfterPull: await shown(fp), ipadEnd: await shown(fi) };
    console.log('C', JSON.stringify(res.C));
    await ipad.close(); await phone.close();
  }
  await L.reset('typical');
  { // K control
    const { ipad, phone, fi, fp } = await pair('K');
    const start = (await server())?.value ?? 0;
    await tap(fp, 5); await sleep(1500);
    await fi.evaluate(() => hub.pull()); await sleep(300);
    const ipadAfterPull = await shown(fi);
    await tap(fi, 3); await sleep(1500);
    res.K = { start, ipadAfterPull, serverEnd: (await server()).value, expected: start + 8 };
    console.log('K', JSON.stringify(res.K));
    await ipad.close(); await phone.close();
  }
} catch (e) { res.error = String(e && e.stack || e); console.error(e); }
finally {
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  await L.close();
}
