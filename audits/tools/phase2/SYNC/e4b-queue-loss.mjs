// SYNC e4b — where queued writes are silently lost or mis-attributed.
//   node "audits/tools/phase2/SYNC/e4b-queue-loss.mjs"
// 1. >200 queued rows in one channel: flush sends them in one batch (no chunking), the Worker answers 400 bad_batch
//    (worker/src/index.js:314) and hub.js drops the whole channel queue (apps/hub.js:268).
// 2. The family queue is not per person (apps/hub.js:30): Eli adds a reminder while the iPad's Wi-Fi is down, taps Switch,
//    and the next person to sign in flushes it. If that is the Downstairs TV (kiosk) profile, the Worker answers 403 read_only
//    and hub.js clears the queue (apps/hub.js:266).
// 3. The activity queue is one list for the device (apps/hub.js:28, 375) and is only drained by the next hub.activity() call
//    (apps/hub.js:376): Eli's offline F260 tick posts its feed line under whoever logs activity next — here Ezra's ★ in Kid Verse.
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, writeEvidence } from './_util.mjs';

const out = { batch: {}, kiosk: {}, kid: {}, activity: {} };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  // server reads go through a separate reader device (Me → Switch on the rig's Kitchen iPad logs its Eli session out)
  const reader = await L.newDevice({ name: 'Audit reader', profiles: ['mom'] });
  const api = p => L.apiAs(null, p, { deviceToken: reader.device.token, profileToken: reader.sessions.mom });
  const reminders = async () => (await api('/api/data/reminders?scope=family')).body.items.filter(i => i.value);

  // ── 1 ── 201 rows queued offline on the phone (a long offline stretch, or any bulk action)
  {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    await phone.goto('#home'); await waitFor(() => phone.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
    const res = []; phone.page.on('response', async r => { if (/\/api\/data\/reminders\/batch/.test(r.url())) res.push({ status: r.status(), body: (await r.text().catch(() => '')).slice(0, 100) }); });
    const before = (await reminders()).length;
    await phone.setOffline(true);
    await phone.page.evaluate(() => { for (let i = 0; i < 201; i++) { const id = 'bulk' + i; hub.set('item:' + id, { id, text: 'Bulk reminder ' + i, by: 'eli', byName: 'Eli', createdAt: Date.now() }, { app: 'reminders', scope: 'family' }); } });
    await phone.setOffline(false);
    await waitFor(() => res.length, { timeout: 10000 }); await sleep(1500);
    const h = await phone.hub();
    out.batch = { response: res[0], serverRemindersBefore: before, serverRemindersAfter: (await reminders()).length, queueAfter: Object.keys(h.queue['hub.queue.reminders.family'] || {}).length,
      shownOnPhone: await phone.page.evaluate(() => hub.list('item:', { app: 'reminders', scope: 'family' }).filter(r => /^Bulk/.test(r.value.text)).length), sync: h.sync };
    log(`1: 201 queued → server said ${out.batch.response.status} ${out.batch.response.body}; server reminders ${before} → ${out.batch.serverRemindersAfter}; queue left ${out.batch.queueAfter}; the phone still lists ${out.batch.shownOnPhone} bulk reminders; sync ${JSON.stringify(out.batch.sync)}`);
    await phone.close();
  }

  // ── 2 ── the Kitchen iPad: Eli's offline reminder, then Switch; next sign-in is the kiosk (a) or Ezra (b)
  for (const next of ['tv', 'ezra']) {
    const o = next === 'tv' ? out.kiosk : out.kid;
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await ipad.goto('#home'); await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
    const res = []; ipad.page.on('response', async r => { if (/\/api\/data\/reminders\/batch/.test(r.url())) res.push({ status: r.status(), body: (await r.text().catch(() => '')).slice(0, 100) }); });
    await ipad.setOffline(true);
    const text = 'Offline reminder by Eli before ' + next;
    await ipad.page.fill('#remtext', text); await ipad.page.press('#remtext', 'Enter');
    o.queuedAfterAdd = Object.keys((await ipad.hub()).queue['hub.queue.reminders.family'] || {}).length;
    await ipad.page.evaluate(() => { location.hash = '#me'; }); await sleep(400);
    await ipad.page.click('#switch');
    await ipad.page.waitForSelector(`.pcard[data-id="${next}"]`, { timeout: 10000 });
    await ipad.setOffline(false);                          // Wi-Fi back while the picker is up
    await sleep(1500);
    o.queueOnPicker = Object.keys((await ipad.hub()).queue['hub.queue.reminders.family'] || {}).length;
    await ipad.page.click(`.pcard[data-id="${next}"]`);
    await waitFor(() => ipad.page.evaluate(n => hub.profile && hub.profile.id === n && hub.sync.lastPull > 0, next), { timeout: 15000 }); await sleep(2000);
    o.response = res[0] || null;
    o.onServer = (await reminders()).some(i => i.value.text === text);
    o.queueAfter = Object.keys((await ipad.hub()).queue['hub.queue.reminders.family'] || {}).length;
    o.sync = (await ipad.hub()).sync;
    o.shot = await shot(ipad.page, `e4b-ipad-after-switch-to-${next}.png`);
    log(`2${next === 'tv' ? 'a' : 'b'}: queued ${o.queuedAfterAdd}, still queued on the picker ${o.queueOnPicker}; next sign-in ${next} → flush answered ${o.response && o.response.status} ${o.response && o.response.body}; on the server: ${o.onServer}; queue left ${o.queueAfter}; sync ${JSON.stringify(o.sync)}`);
    await ipad.close();
  }

  // ── 3 ── activity queue: Eli ticks F260 offline on the iPad, Wi-Fi returns; later Ezra earns a ★ in Kid Verse
  {
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const f = await ipad.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(800);
    await ipad.setOffline(true);
    await f.click('#todayDone');
    await sleep(500);
    out.activity.queuedLine = (await ipad.page.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]'))).map(a => a.text);
    await ipad.setOffline(false);
    await sleep(35000);                                      // a pull and a flush happen; the data syncs
    const feedHas = async re => (await api('/api/activity?limit=100')).body.activity.filter(a => re.test(a.text) && (a.profile_id === 'eli' || a.profile_id === 'ezra')).map(a => a.name + ': ' + a.text);
    out.activity.feedAfter35sOnline = await feedHas(/^Read week 38 day 3/);
    out.activity.stillQueued = (await ipad.page.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]'))).map(a => a.text);
    log(`3: Eli's offline tick queued feed line ${JSON.stringify(out.activity.queuedLine)}; 35 s after Wi-Fi returned the feed has: ${JSON.stringify(out.activity.feedAfter35sOnline)}; still queued: ${JSON.stringify(out.activity.stillQueued)}`);
    await ipad.page.evaluate(() => { location.hash = '#me'; }); await sleep(400);
    await ipad.page.click('#switch');
    await ipad.page.waitForSelector('.pcard[data-id="ezra"]'); await ipad.page.click('.pcard[data-id="ezra"]');
    await waitFor(() => ipad.page.evaluate(() => hub.profile && hub.profile.id === 'ezra'), { timeout: 10000 });
    const kv = await ipad.openApp('kidverse', { wait: '#done' });
    await waitFor(() => kv.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(1500);
    out.activity.doneVisible = await kv.evaluate(() => !document.querySelector('#done').hidden);
    await kv.evaluate(() => document.querySelector('#done').click());
    await sleep(2500);
    out.activity.feedAfterEzraStar = await feedHas(/^Read week 38 day 3|read the verse/);
    out.activity.shot = await shot(ipad.page, 'e4b-ipad-kidverse-after-star.png');
    log(`3: after Ezra's ★ on the same iPad the feed has: ${JSON.stringify(out.activity.feedAfterEzraStar)}`);
  }
  log('evidence', writeEvidence('e4b-queue-loss.json', out));
} finally { await L.close(); }
