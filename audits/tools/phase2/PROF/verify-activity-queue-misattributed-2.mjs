// PROF skeptic #2 for "activity-queue-misattributed": queued activity lines are posted under whoever signs in next.
// Independent of switch-ipad.mjs. Kitchen iPad (WebKit), real clock, typical seed, all driven through the UI.
//
//   node "audits/tools/phase2/PROF/verify-activity-queue-misattributed-2.mjs"      (about 1.5 minutes)
//
// Steps:
//   0. control: Eli online adds a reminder -> its feed line lands under eli at once
//   1. Eli offline adds a reminder -> the line waits in localStorage hub.activityQueue (no author stored)
//   2. back online as Eli for 35 s (online event + one 30 s pull) -> is the queue drained? (claim: no)
//   3. Me -> Switch -> Downstairs TV (kiosk) for 6 s -> is it drained? (claim: no, kiosk cannot write)
//   4. TV Switch -> Ezra (kid, opens on tap) -> is it drained on sign-in? (claim: no)
//   5. Ezra taps Kid Verse "Done ★" (a real app action that calls hub.activity) -> server feed author of Eli's line
// Evidence: audits/evidence/p2/PROF/verify-activity-queue-misattributed-2.json (+ .png of Eli's phone Home feed).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const TAG = 'V2Q' + Date.now().toString(36).slice(-4);
const R = { tag: TAG, steps: [] };
const log = (k, v) => { R.steps.push({ k, v }); console.log(k.padEnd(52), typeof v === 'string' ? v : JSON.stringify(v)); };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const tStart = Date.now();
  // Read the server with Eli's session on a SEPARATE phone: the iPad's Switch calls /api/logout while online, which
  // revokes the rig's own Eli token, so apiAs('eli') would 401 (and read as an empty feed) after step 3.
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const asPhone = p => L.apiAs(null, p, { deviceToken: ph.device.token, profileToken: ph.sessions.eli });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const { page } = ipad;
  const q = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('hub.activityQueue') || '[]'); } catch { return 'unreadable'; } });
  const feed = async () => ((await asPhone('/api/activity?limit=100')).body.activity || [])
    .filter(a => a.text.includes(TAG)).map(a => ({ author: a.profile_id, name: a.name, text: a.text, created_at: a.created_at }));
  const waitShell = id => page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, id, { timeout: 15000 });
  const tap = sel => page.locator(sel).first().click();
  const addReminder = async text => { await tap('.tab[data-tab="home"]'); await page.waitForSelector('#remtext'); await page.fill('#remtext', text); await page.press('#remtext', 'Enter'); await sleep(700); };

  await ipad.goto('#home');
  await waitShell('eli');
  await page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 20000 });

  // 0. control
  await addReminder(`${TAG} Eli online: eggs`);
  log('0. control, server feed (online Eli)', await feed());

  // 1. offline reminder
  await ipad.setOffline(true);
  await addReminder(`${TAG} Eli offline: buy milk`);
  const queued = await q();
  log('1. hub.activityQueue after offline add', queued);
  const queuedAt = (queued.find(x => x.text.includes('offline')) || {}).at;

  // 2. back online as Eli, 35 s
  await ipad.setOffline(false);
  const lp = await page.evaluate(() => hub.sync.lastPull);
  await sleep(35000);
  log('2. Eli online 35 s: pulls happened since reconnect', String((await page.evaluate(() => hub.sync.lastPull)) > lp));
  log('2. hub.sync', await page.evaluate(() => ({ state: hub.sync.state, pending: hub.sync.pending })));
  log('2. hub.activityQueue', await q());
  log('2. server feed', await feed());
  const rem = ((await asPhone('/api/data/reminders?scope=family')).body.items || []).filter(i => i.value && String(i.value.text || '').includes(TAG + ' Eli offline'));
  log('2. server: the offline reminder ROW itself landed', rem.length ? JSON.stringify(rem[0].value) : 'no');

  // 3. switch to the Downstairs TV (kiosk)
  await tap('.tab[data-tab="me"]'); await page.waitForSelector('#switch'); await tap('#switch');
  await page.waitForSelector('#profiles .pcard[data-id="tv"]', { timeout: 15000 });
  await tap('#profiles .pcard[data-id="tv"]');
  await page.waitForFunction(() => !document.getElementById('shell').hidden && document.documentElement.dataset.kind === 'kiosk', null, { timeout: 15000 });
  await sleep(6000);
  log('3. kiosk: hub.canWrite / queue', { canWrite: await page.evaluate(() => hub.canWrite), queue: await q() });
  log('3. server feed', await feed());

  // 4. TV -> Ezra
  await tap('#kiosk-switch');
  await page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 15000 });
  await tap('#profiles .pcard[data-id="ezra"]');
  await waitShell('ezra');
  await sleep(4000);
  log('4. Ezra signed in (no action yet): queue', await q());
  log('4. server feed', await feed());

  // 5. Ezra: Kid Verse Done ★
  await tap('.tab[data-tab="apps"]'); await page.waitForSelector('#grid .tile[data-id="kidverse"]'); await tap('#grid .tile[data-id="kidverse"]');
  let kv; for (let i = 0; i < 80 && !(kv = ipad.frame('kidverse')); i++) await sleep(100);
  await kv.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 }); await sleep(2500);
  const doneTxt = await kv.evaluate(() => { const b = document.getElementById('done'); return b && !b.hidden ? b.textContent.trim() : null; });
  if (doneTxt === 'Done ★') { await kv.click('#done'); log('5. Ezra tapped Kid Verse "Done ★"', 'ok'); }
  else { await kv.evaluate(t => hub.activity(t + ' Ezra fallback action'), TAG); log('5. Done ★ not shown (' + doneTxt + '): hub.activity from Kid Verse instead', 'ok'); }
  await sleep(3000);
  const all = ((await asPhone('/api/activity?limit=100')).body.activity || []).filter(a => a.created_at > tStart && (a.text.includes(TAG) || /read the verse|earned the/.test(a.text)))
    .map(a => ({ author: a.profile_id, name: a.name, text: a.text, created_at: a.created_at }));
  log('5. server feed this run (newest first)', all);
  const mis = all.find(a => a.text.includes(TAG + ' Eli offline'));
  log('5. VERDICT: Eli\'s offline line stored under', mis ? `${mis.author} (${mis.name}), ${Math.round((mis.created_at - queuedAt) / 1000)} s after Eli queued it` : 'not posted');
  log('5. hub.activityQueue now', await q());

  // what Eli's own phone shows on Home
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  await phone.goto('#home');
  await phone.page.waitForFunction(t => document.body.innerText.includes(t), TAG + ' Eli offline', { timeout: 20000 }).catch(() => {});
  const line = await phone.page.evaluate(t => { const el = [...document.querySelectorAll('#view-home *')].reverse().find(e => e.children.length < 6 && e.innerText && e.innerText.includes(t)); if (!el) return null; const row = el.closest('li, .row, .feed-item, .item') || el; row.scrollIntoView({ block: 'center' }); return row.innerText.replace(/\s+/g, ' ').trim(); }, TAG + ' Eli offline');
  log('6. Eli phone Home feed row for the line', line || 'not rendered on Home');
  await sleep(500);
  R.evidence = path.relative(ROOT, path.join(OUT, 'verify-activity-queue-misattributed-2-phone-home.png'));
  await phone.page.screenshot({ path: path.join(ROOT, R.evidence), scale: 'css', animations: 'disabled', caret: 'hide' });
  R.logs = ipad.logs.slice(-15);
  fs.writeFileSync(path.join(OUT, 'verify-activity-queue-misattributed-2.json'), JSON.stringify(R, null, 1));
  console.log('evidence:', R.evidence);
} finally { await L.close(); }
