// Completeness critic: Tally taps queued while offline are sent ONLY by the Tally frame itself. The shell's hub.js does
// not sync the tally channel (index.html:458), and closeViewer's hub.flush() (index.html:729-734) flushes only the
// shell's channels, so if the person leaves Tally before the connection returns, the taps sit in
// localStorage hub.queue.tally.person.<pid> until Tally is reopened on that device. Meanwhile the shell reads synced.
// If the same person counts on another device in between, the stranded taps later lose last-write-wins.
//   S  phone offline: open Tally, +4 (37->41), tap the viewer's Hub button, back online, wait 35 s;
//      then the Kitchen iPad (Eli) opens Tally and taps +2; then the phone reopens Tally.     expected 43
//   S0 control: the same, but Tally stays open when the phone comes back online.              expected 43
// Run: node "audits/tools/phase3/tally/critic-stranded.mjs"  -> audits/evidence/p3/tally/critic-stranded.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = {};
const server = async () => { const r = await L.apiAs('eli', '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
const shown = f => f.evaluate(() => document.getElementById('n').textContent);
const ready = f => f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
const tap = async (f, n) => { for (let i = 0; i < n; i++) await f.locator('#plus').click(); };
const tallyQueue = p => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.queue.tally')).map(k => [k, localStorage.getItem(k)])));
try {
  for (const closeFirst of [true, false]) {
    const key = closeFirst ? 'S' : 'S0';
    const phDev = await L.newDevice({ name: 'Eli phone ' + key, profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: phDev });
    let fp = await phone.openApp('tally'); await ready(fp);
    const start = await server();
    await phone.setOffline(true);
    await tap(fp, 4); await sleep(400);
    const offlineShown = await shown(fp);
    if (closeFirst) { await phone.page.click('#pill-home'); await sleep(600); }
    await phone.setOffline(false);
    await sleep(35000);                               // the shell's own 30 s poll + reconnect handlers
    const afterOnline = await server();
    const shellSync = await phone.page.evaluate(() => ({ ...hub.sync }));
    const queueLeft = await tallyQueue(phone.page);
    const viewerOpen = await phone.page.evaluate(() => document.getElementById('viewer').classList.contains('on'));
    // the same person counts on the Kitchen iPad
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const fi = await ipad.openApp('tally'); await ready(fi); await sleep(1500);
    const ipadShowsAtOpen = await shown(fi);
    await tap(fi, 2); await sleep(2000);
    const afterIpad = await server();
    // the phone opens Tally again (Apps tab -> Tally tile)
    if (closeFirst) { await phone.page.click('.tab[data-tab=apps]'); await sleep(300); await phone.page.click('.tile[data-id=tally]'); await sleep(300); fp = phone.frame('tally'); await ready(fp); }
    await sleep(4000);
    res[key] = { start, offlineShown, viewerOpenWhenOnline: viewerOpen, afterOnline_35s: afterOnline, shellSyncAfterOnline: shellSync, tallyQueueLeftInLocalStorage: queueLeft,
      ipadShowsAtOpen, afterIpad, serverEnd: await server(), phoneShowsEnd: await shown(fp), expected: start + 6 };
    console.log(key, JSON.stringify(res[key]));
    await ipad.close(); await phone.close();
    await L.reset('typical');
  }
} finally {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(OUT + '/critic-stranded.json', JSON.stringify(res, null, 2));
  await L.close();
}
