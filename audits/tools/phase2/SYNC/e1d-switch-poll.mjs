// SYNC e1d — does the shell keep polling after an in-page profile switch?
//   node "audits/tools/phase2/SYNC/e1d-switch-poll.mjs"
// hub.reset() clears the 30 s pull interval (apps/hub.js:370) but hub.ready() only re-creates it when !wired (apps/hub.js:338-342),
// and enterShell() calls hub.reset() + hub.ready() on every sign-in (index.html:623).
// iPad: Eli → Me → Switch → Ezra (Home). TV: kiosk board → Switch → Downstairs TV again.
// Eli's phone then adds a family reminder; does it reach the switched screen within 75 s (2.5 poll periods)?
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, netLog, writeEvidence, setHidden } from './_util.mjs';

const out = { ipad: {}, tv: {} };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  await phone.goto('#home');
  await waitFor(() => phone.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  const addReminder = text => phone.page.evaluate(text => { const id = hub.uid(); hub.set('item:' + id, { id, text, by: 'eli', byName: 'Eli', createdAt: Date.now() }, { app: 'reminders', scope: 'family' }); }, text);
  const gets = (net, a, b) => net.filter(r => r.t >= a && r.t < b && r.method === 'GET' && r.url.startsWith('/api/data/')).length;
  const shows = (page, text) => page.evaluate(text => { const ul = document.querySelector('#remlist'); return !!ul && ul.textContent.includes(text); }, text);

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const inet = netLog(ipad.page);
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  const tnet = netLog(tv.page);
  await ipad.goto('#home'); await tv.goto('#home');
  await waitFor(() => ipad.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });
  await waitFor(() => tv.page.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 });

  // control: before any switch, a new reminder reaches both screens within one poll period
  let t = Date.now(); await addReminder('SYNC-e1d control reminder');
  const ci = await waitFor(() => shows(ipad.page, 'SYNC-e1d control'), { timeout: 40000, every: 200 }); out.ipad.controlMs = ci ? Date.now() - t : null;
  const ct = await waitFor(() => shows(tv.page, 'SYNC-e1d control'), { timeout: 40000, every: 200 }); out.tv.controlMs = ct ? Date.now() - t : null;
  log(`control (no switch yet): iPad shows the new reminder after ${out.ipad.controlMs} ms, TV after ${out.tv.controlMs} ms`);
  let a = Date.now(); await sleep(61000);
  out.ipad.getsIn61sBefore = gets(inet, a, Date.now()); out.tv.getsIn61sBefore = gets(tnet, a, Date.now());

  // iPad: Me → Switch → Ezra, then Home
  await ipad.page.evaluate(() => { location.hash = '#me'; }); await sleep(500);
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="ezra"]', { timeout: 10000 });
  await ipad.page.click('.pcard[data-id="ezra"]');
  await waitFor(() => ipad.page.evaluate(() => hub.profile && hub.profile.id === 'ezra' && hub.sync.lastPull > 0), { timeout: 15000 });
  await ipad.page.click('.tab[data-tab="home"]');
  // TV: Switch → Downstairs TV
  await tv.page.click('#kiosk-switch');
  await tv.page.waitForSelector('.pcard[data-id="tv"]', { timeout: 10000 });
  await tv.page.click('.pcard[data-id="tv"]');
  await waitFor(() => tv.page.evaluate(() => hub.profile && hub.profile.id === 'tv' && hub.sync.lastPull > 0 && !!document.querySelector('#tv')), { timeout: 15000 });
  await sleep(1500);

  t = Date.now(); await addReminder('SYNC-e1d after-switch reminder');
  await sleep(75000);
  out.ipad.getsIn75sAfter = gets(inet, t, Date.now()); out.tv.getsIn75sAfter = gets(tnet, t, Date.now());
  out.ipad.showsAfter75s = await shows(ipad.page, 'after-switch'); out.tv.showsAfter75s = await shows(tv.page, 'after-switch');
  out.ipad.shot = await shot(ipad.page, 'e1d-ipad-ezra-home-75s-after-switch.png');
  out.tv.shot = await shot(tv.page, 'e1d-tv-board-75s-after-switch.png');
  log(`iPad: /api/data GETs in 61 s before the switch ${out.ipad.getsIn61sBefore}, in 75 s after ${out.ipad.getsIn75sAfter}; Ezra's Home shows the phone's new reminder after 75 s: ${out.ipad.showsAfter75s}`);
  log(`TV:   /api/data GETs in 61 s before the switch ${out.tv.getsIn61sBefore}, in 75 s after ${out.tv.getsIn75sAfter}; the board shows the phone's new reminder after 75 s: ${out.tv.showsAfter75s}`);
  // what does bring it in: a visibility change (the TV never has one), closing an app, or pull-to-refresh
  await setHidden(ipad.page, true); await setHidden(ipad.page, false);
  out.ipad.afterVisibility = !!(await waitFor(() => shows(ipad.page, 'after-switch'), { timeout: 8000, every: 100 }));
  log(`iPad after a hidden→visible cycle shows it: ${out.ipad.afterVisibility}`);
  log('evidence', writeEvidence('e1d-switch-poll.json', out));
} finally { await L.close(); }
