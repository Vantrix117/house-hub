// COPY (batch 0e) of phase2/SYNC/e2a-stale-overwrite.mjs: in-page reads of the old whole-map rows replaced by the merged view; see make-merged-copies.mjs
// SYNC e2a — F260 whole-map rows under last-write-wins: a device that has not pulled yet overwrites another device's tick.
//   node "audits/tools/phase2/SYNC/e2a-stale-overwrite.mjs"
// Both devices are online and signed in as Eli with F260 open. The phone ticks today's reading (Acts 6, 38-2).
// Before the iPad's next 30 s poll, Eli ticks the following reading (Acts 7, 38-3) in the iPad's week list
// (e.g. "I already read Acts 6 on my phone"). f260.done / f260.log are single rows holding the whole map.
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, shot, writeEvidence } from '../../phase2/SYNC/_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const fi = await ipad.openApp('f260', { wait: '#todayDone' });
  const fp = await phone.openApp('f260', { wait: '#todayDone' });
  for (const fr of [fi, fp]) await waitFor(() => fr.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  await sleep(1000);
  const doneOf = fr => fr.evaluate(() => { const d = hub.rowMap('done:', 'f260.done'); return ['38-0', '38-1', '38-2', '38-3', '38-4'].filter(k => d[k]); });
  const uiDone = (fr, id) => fr.evaluate(id => document.querySelector('[data-day="' + id + '"]').classList.contains('done'), id);

  // 1. phone ticks Acts 6 with the Today card's Done
  const tPhone = Date.now();
  await fp.click('#todayDone');
  await waitFor(async () => { const r = await serverRow(L, 'eli', 'f260', 'f260.done'); return r && r.value['38-2']; }, { timeout: 8000, every: 50 });
  out.serverAfterPhone = Object.keys((await serverRow(L, 'eli', 'f260', 'f260.done')).value).filter(k => k.startsWith('38-'));
  log('server f260.done week 38 after the phone tick:', out.serverAfterPhone.join(','), `(${Date.now() - tPhone} ms)`);

  // 2. iPad (not yet pulled) ticks Acts 7 in its week list
  out.ipadMapBeforeItsTick = await doneOf(fi);
  out.ipadPulledSincePhoneTick = await fi.evaluate(t => hub.sync.lastPull > t, tPhone);
  await fi.evaluate(() => document.querySelector('[data-day="38-3"] .mark').click());
  await waitFor(async () => { const r = await serverRow(L, 'eli', 'f260', 'f260.done'); return r && r.value['38-3']; }, { timeout: 8000, every: 50 });
  const srv = await serverRow(L, 'eli', 'f260', 'f260.done');
  out.serverAfterIpad = Object.keys(srv.value).filter(k => k.startsWith('38-'));
  log('iPad map before its tick (week 38):', out.ipadMapBeforeItsTick.join(','), '| iPad had pulled since the phone tick:', out.ipadPulledSincePhoneTick);
  log('server f260.done week 38 after the iPad tick:', out.serverAfterIpad.join(','), '→ 38-2 (the phone tick) present:', !!srv.value['38-2']);

  // 3. phone's next poll adopts the server row: the phone's own tick disappears from the phone
  const tWait = Date.now();
  const gone = await waitFor(async () => !(await uiDone(fp, '38-2')), { timeout: 40000, every: 200 });
  out.phoneLostTickAfterMs = gone ? Date.now() - tWait : null;
  out.phoneMap = await doneOf(fp);
  out.phoneToday = await fp.textContent('#todayTitle');
  out.phoneToast = await fp.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
  out.phoneShellToast = await phone.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
  out.phoneSync = (await phone.hub(fp)).sync;
  out.log = (await serverRow(L, 'eli', 'f260', 'f260.log')).value;
  out.summary = (await serverRow(L, 'eli', 'f260', 'f260.summary')).value;
  out.shotPhone = await shot(phone.page, 'e2a-phone-after-overwrite.png');
  out.shotIpad = await shot(ipad.page, 'e2a-ipad-after-overwrite.png');
  log(`phone: 38-2 un-ticked on the phone ${out.phoneLostTickAfterMs} ms later; phone map now ${out.phoneMap.join(',')}; phone Today card says "${out.phoneToday}"`);
  log('any toast on the phone (app / shell):', out.phoneToast, '/', out.phoneShellToast, '| phone sync state:', JSON.stringify(out.phoneSync));
  log('server summary:', JSON.stringify(out.summary));
  // the activity line for the lost tick is still in the feed
  const feed = (await L.apiAs('eli', '/api/activity?limit=5')).body.activity.map(a => a.name + ': ' + a.text);
  out.feed = feed; log('feed (newest first):', feed.slice(0, 3).join(' || '));
  log('evidence', writeEvidence('e2a-stale-overwrite.json', out));
} finally { await L.close(); }
