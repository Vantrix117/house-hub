// SYNC e2e — while the F260 journal is unlocked, F260 defers every remote change ("busy": apps/f260.html:2089-2090) until the
// journal locks again (autolock default 15 min, :920, :2041-2046). Its in-memory `done` map stays stale that whole time, and the next
// tick writes that stale map over the other device's tick.
//   node "audits/tools/phase2/SYNC/e2e-journal-busy.mjs"
// iPad: Eli sets up / unlocks the journal (passcode), then goes back to the plan. Phone: Eli ticks Acts 6. 35 s later the iPad has
// pulled it; Eli ticks Acts 7 on the iPad.
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, shot, writeEvidence } from './_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const fi = await ipad.openApp('f260', { wait: '#todayDone' });
  const fp = await phone.openApp('f260', { wait: '#todayDone' });
  for (const fr of [fi, fp]) await waitFor(() => fr.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  // iPad: Journal → set a passcode (the journal is now open), back to Plan
  await fi.click('#tabJournal');
  await fi.waitForSelector('#pass.on', { timeout: 5000 });
  await fi.fill('#pass1', 'amen1234'); await fi.fill('#pass2', 'amen1234'); await fi.click('#passOk');
  await waitFor(() => fi.evaluate(() => !document.getElementById('pass').classList.contains('on')), { timeout: 15000 });
  await fi.click('#tabPlan'); await sleep(1500);
  // phone ticks Acts 6
  const t = Date.now();
  await fp.click('#todayDone');
  await waitFor(async () => (await serverRow(L, 'eli', 'f260', 'f260.done')).value['38-2'], { timeout: 8000, every: 100 });
  await waitFor(() => fi.evaluate(t => hub.sync.lastPull > t + 500, t), { timeout: 40000, every: 200 }); await sleep(1000);
  out.ipadStoreHas382 = await fi.evaluate(() => !!(hub.get('f260.done') || {})['38-2']);
  out.ipadUiShows382 = await fi.evaluate(() => document.querySelector('[data-day="38-2"]').classList.contains('done'));
  out.ipadToday = await fi.textContent('#todayTitle');
  out.shot = await shot(ipad.page, 'e2e-ipad-journal-open-stale.png');
  log(`iPad pulled the phone's tick: store has 38-2 = ${out.ipadStoreHas382}; F260 shows it = ${out.ipadUiShows382}; Today card still says "${out.ipadToday}"`);
  // iPad ticks Acts 7 in its week list
  await fi.evaluate(() => document.querySelector('[data-day="38-3"] .mark').click());
  await sleep(2500);
  const done = (await serverRow(L, 'eli', 'f260', 'f260.done')).value;
  out.server = { '38-2 (phone)': !!done['38-2'], '38-3 (iPad)': !!done['38-3'] };
  log(`after the iPad's tick the server has: ${JSON.stringify(out.server)}`);
  log('evidence', writeEvidence('e2e-journal-busy.json', out));
} finally { await L.close(); }
