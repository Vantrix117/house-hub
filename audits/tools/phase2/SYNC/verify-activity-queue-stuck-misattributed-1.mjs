// Skeptic #1 for SYNC finding "activity-queue-stuck-misattributed".
//   node "audits/tools/phase2/SYNC/verify-activity-queue-stuck-misattributed-1.mjs"
// Independent re-run: Eli ticks F260 on the Kitchen iPad while the Wi-Fi is down, the Wi-Fi returns, we wait for the
// online flush + a 30 s poll, reload the shell and reopen F260 (an app reopen), then Eli taps Switch and Ezra earns a ★
// in Kid Verse on the same iPad. We record the server's feed, the device's hub.activityQueue, the F260 row on the server,
// and what the TV board's "Reading today" shows (a separate kiosk context).
import { local, sleep } from '../../lib/local.mjs';
import { waitFor, shot, writeEvidence } from './_util.mjs';

const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const reader = await L.newDevice({ name: 'Skeptic reader', profiles: ['mom'] });
  const api = p => L.apiAs(null, p, { deviceToken: reader.device.token, profileToken: reader.sessions.mom });
  const feed = async () => (await api('/api/activity?limit=200')).body.activity;
  const readLines = async () => (await feed()).filter(a => /^Read week/.test(a.text)).map(a => ({ who: a.profile_id, text: a.text, at: new Date(a.created_at).toISOString() }));
  const q = async page => (await page.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]')));

  out.readLinesBefore = await readLines();
  log('server "Read week" lines before:', JSON.stringify(out.readLinesBefore));

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  let f = await ipad.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
  const f260Before = (await L.apiAs('eli', '/api/data/f260?scope=person')).body.items.map(i => i.key + '@' + i.updated_at).sort();

  // 1. offline tick
  await ipad.setOffline(true);
  out.onLineInFrameWhileOffline = await f.evaluate(() => navigator.onLine);
  await f.click('#todayDone'); await sleep(600);
  const queued = await q(ipad.page);
  out.queuedWhileOffline = queued;
  out.tickAt = queued.length ? new Date(queued[queued.length - 1].at).toISOString() : null;
  log('offline tick → queue', JSON.stringify(queued.map(x => ({ app: x.app_id, text: x.text }))), 'navigator.onLine in frame =', out.onLineInFrameWhileOffline);

  // 2. Wi-Fi back: online event fires in shell + frame; wait for the flush and one 30 s poll
  const actPosts = []; ipad.page.on('request', r => { if (/\/api\/activity$/.test(r.url()) && r.method() === 'POST') actPosts.push({ t: Date.now(), body: r.postData() }); });
  await ipad.setOffline(false);
  await sleep(36000);
  const f260After = (await L.apiAs('eli', '/api/data/f260?scope=person')).body.items.map(i => i.key + '@' + i.updated_at).sort();
  out.f260RowsChangedOnServer = f260After.filter(x => !f260Before.includes(x));
  out.frameSyncAfter36s = await f.evaluate(() => ({ ...hub.sync }));
  out.activityPostsAfterOnline = actPosts.length;
  out.queueAfter36s = (await q(ipad.page)).map(x => x.text);
  out.readLinesAfter36s = await readLines();
  log('36 s online: F260 rows changed on server', JSON.stringify(out.f260RowsChangedOnServer), '; frame sync', JSON.stringify(out.frameSyncAfter36s));
  log('36 s online: POST /api/activity sent =', actPosts.length, '; queue =', JSON.stringify(out.queueAfter36s), '; server Read lines =', JSON.stringify(out.readLinesAfter36s));

  // 3. reload the shell and reopen F260 (an app reopen / next launch) — still Eli
  f = await ipad.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(3000);
  out.queueAfterReopen = (await q(ipad.page)).map(x => x.text);
  out.activityPostsAfterReopen = actPosts.length;
  log('after reload + reopen F260 as Eli: POSTs =', actPosts.length, '; queue =', JSON.stringify(out.queueAfterReopen));

  // 4. TV board (separate kiosk context): Reading today
  const tvRead = async () => {
    const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    await tv.goto('#home');
    await tv.page.waitForSelector('#tv-read .tv-face', { timeout: 15000 }).catch(() => {});
    await sleep(2500);
    const r = await tv.page.evaluate(() => [...document.querySelectorAll('#tv-read .tv-face')].map(e => (e.classList.contains('off') ? 'off ' : 'on  ') + e.textContent.trim()));
    return { r, tv };
  };
  { const { r, tv } = await tvRead(); out.tvReadingBeforeEzra = r; log('TV Reading today (before Ezra):', JSON.stringify(r)); await tv.close(); }

  // 5. Switch → Ezra, Kid Verse ★
  await ipad.goto('#me'); await sleep(600);
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="ezra"]', { timeout: 10000 }); await ipad.page.click('.pcard[data-id="ezra"]');
  await waitFor(() => ipad.page.evaluate(() => hub.profile && hub.profile.id === 'ezra'), { timeout: 10000 });
  const kv = await ipad.openApp('kidverse', { wait: '#done' });
  await waitFor(() => kv.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(1500);
  out.kidDoneVisible = await kv.evaluate(() => !document.querySelector('#done').hidden);
  await kv.evaluate(() => document.querySelector('#done').click());
  await sleep(3000);
  const all = await feed();
  const since = Date.parse(out.tickAt) - 1000;
  out.feedTopAfterEzra = all.filter(a => a.created_at >= since && a.created_at < Date.now() + 60000 && (a.profile_id === 'eli' || a.profile_id === 'ezra')).map(a => ({ who: a.profile_id, name: a.name, text: a.text, at: new Date(a.created_at).toISOString() }));
  out.queueAfterEzra = (await q(ipad.page)).map(x => x.text);
  out.shot = await shot(ipad.page, 'verify-aq1-ipad-kidverse-after-star.png');
  log('after Ezra ★: feed lines by Eli/Ezra since the offline tick', JSON.stringify(out.feedTopAfterEzra));
  log('after Ezra ★: queue =', JSON.stringify(out.queueAfterEzra));

  { const { r, tv } = await tvRead(); out.tvReadingAfterEzra = r; out.tvShot = await shot(tv.page, 'verify-aq1-tv-after-ezra.png'); log('TV Reading today (after Ezra):', JSON.stringify(r)); await tv.close(); }
  log('evidence', writeEvidence('verify-activity-queue-stuck-misattributed-1.json', out));
} finally { await L.close(); }
