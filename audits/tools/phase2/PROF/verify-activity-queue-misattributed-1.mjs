// PROF skeptic #1: "Queued activity lines are posted under whoever is signed in next" (activity-queue-misattributed).
// Independent minimal repro on the local rig (real clock, typical seed, WebKit iPad), driven through the shell UI.
//
//   node "audits/tools/phase2/PROF/verify-activity-queue-misattributed-1.mjs"      (about 1.5 minutes)
//
// A. Eli offline on the Kitchen iPad adds a house reminder (Home → "Add a reminder") → feed line goes to hub.activityQueue.
// B. Eli comes back ONLINE and stays signed in; wait for a pull + flush. Does the queued feed line reach the server?
// C. Me → Switch → Ezra (kid, tap). Ezra taps Kid Verse "Done ★". Whose name is on Eli's queued line on the server?
// D. Mae (PIN) offline adds a reminder → Switch → Downstairs TV (kiosk) online for 35 s: does the line drain? Then the
//    TV signs out and Kiara (kid) signs in and does one feed-writing action: whose name is on Mae's line?
// Evidence: audits/evidence/p2/PROF/verify-activity-queue-misattributed-1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const NONCE = 'V' + Date.now().toString(36).slice(-5);
const R = { nonce: NONCE, steps: [] };
const log = (k, v) => { R.steps.push({ k, v }); console.log(k.padEnd(62), typeof v === 'string' ? v : JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'real' });
const MAE_PIN = '2580';
try {
  await L.apiAs('eli', '/api/admin/profiles/christian/reset-pin', { method: 'POST', body: {} });
  await L.apiAs(null, '/api/profiles/christian/pin', { method: 'POST', body: { pin: MAE_PIN } });
  // read the server from a separate paired device: Switch on the iPad calls /api/logout, which kills the iPad's Eli session
  const rd = await L.newDevice({ name: 'Reader', profiles: ['eli'] });
  const RD = { deviceToken: rd.device.token, profileToken: rd.sessions.eli };
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const { page } = ipad;
  const tap = sel => page.locator(sel).first().click();
  const aq = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('hub.activityQueue')) || []; } catch { return null; } });
  const feed = async () => ((await L.apiAs('eli', '/api/activity?limit=100', RD)).body.activity || []).filter(a => a.text.includes(NONCE)).map(a => ({ by: a.profile_id, name: a.name, text: a.text, created_at: a.created_at }));
  const rems = async () => ((await L.apiAs('eli', '/api/data/reminders?scope=family', RD)).body.items || []).filter(i => i.value && String(i.value.text).includes(NONCE)).map(i => ({ key: i.key, byName: i.value.byName }));
  const waitProfile = id => page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, id, { timeout: 15000 });
  const switchTo = async id => { await tap('.tab[data-tab="me"]'); await page.waitForSelector('#switch'); await tap('#switch'); await page.waitForSelector(`#profiles .pcard[data-id="${id}"]`, { timeout: 15000 }); };

  // ── A ──
  await ipad.goto('#home');
  await page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 });
  await page.waitForSelector('#remtext');
  await ipad.setOffline(true);
  const tA = Date.now();
  await page.fill('#remtext', `${NONCE} Eli: buy milk`); await page.press('#remtext', 'Enter'); await sleep(500);
  log('A. Eli offline added reminder; hub.activityQueue', await aq());

  // ── B: Eli back online, still Eli ──
  await ipad.setOffline(false);
  const lp = await page.evaluate(() => hub.sync.lastPull);
  await page.waitForFunction(s => hub.sync.lastPull > s && hub.sync.state === 'synced', lp, { timeout: 20000 }).catch(() => {});
  await sleep(4000);
  log('B. Eli online again: hub.sync', await page.evaluate(() => ({ state: hub.sync.state, pending: hub.sync.pending, profile: hub.profile.id })));
  log('B. server: the reminder row (data queue) flushed?', await rems());
  log('B. server: the feed line posted?', (await feed()).length ? await feed() : 'NO — not posted after reconnect');
  log('B. hub.activityQueue still holds', await aq());

  // ── C: switch to Ezra, Ezra taps Kid Verse Done ★ ──
  await switchTo('ezra'); const tSwitch = Date.now();
  await tap('#profiles .pcard[data-id="ezra"]'); await waitProfile('ezra'); await sleep(2500);
  log('C. Ezra signed in (online) — feed before his own action', (await feed()).length ? await feed() : 'still not posted');
  await tap('.tab[data-tab="apps"]'); await page.waitForSelector('#grid .tile[data-id="kidverse"]'); await tap('#grid .tile[data-id="kidverse"]');
  let kv; for (let i = 0; i < 80 && !(kv = ipad.frame('kidverse')); i++) await sleep(100);
  await kv.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 }); await sleep(2500);
  const doneTxt = await kv.evaluate(() => { const b = document.getElementById('done'); return b && !b.hidden ? b.textContent.trim() : null; });
  if (doneTxt === 'Done ★') { await kv.click('#done'); log('C. Ezra tapped Kid Verse "Done ★"', 'yes'); }
  else { await kv.evaluate(n => hub.activity('Ezra action ' + n), NONCE); log('C. Done ★ not offered (' + doneTxt + '): Kid Verse frame called hub.activity', 'fallback'); }
  await sleep(3000);
  const fc = await feed();
  log('C. server feed lines for this run', fc);
  const eliLine = fc.find(l => l.text.includes('Eli: buy milk'));
  log('C. VERDICT Eli\'s line attributed to', eliLine ? `${eliLine.by} (${eliLine.name}), posted ${Math.round((eliLine.created_at - tA) / 1000)} s after Eli typed it, ${Math.round((eliLine.created_at - tSwitch) / 1000)} s after the switch` : 'not posted');
  const kvAll = await L.apiAs('eli', '/api/activity?limit=100', RD);
  log('C. newest 3 feed rows (any text)', kvAll.body.activity.slice().sort((a, b) => b.created_at - a.created_at).slice(0, 3).map(a => `${a.profile_id}: ${a.text}`));
  log('C. hub.activityQueue after Ezra', await aq());

  // ── D: Mae offline → TV (kiosk) → Kiara ──
  await tap('#pill-home').catch(() => {}); await sleep(300);
  await switchTo('christian'); await tap('#profiles .pcard[data-id="christian"]');
  await page.waitForSelector('#pad'); for (const d of MAE_PIN) await tap(`#pad [data-d="${d}"]`); await tap('#pingo');
  await waitProfile('christian'); await sleep(1500);
  await tap('.tab[data-tab="home"]'); await page.waitForSelector('#remtext');
  await ipad.setOffline(true);
  await page.fill('#remtext', `${NONCE} Mae: dentist 3pm`); await page.press('#remtext', 'Enter'); await sleep(500);
  log('D. Mae offline added reminder; hub.activityQueue', await aq());
  await switchTo('tv'); await ipad.setOffline(false); await sleep(300);
  await tap('#profiles .pcard[data-id="tv"]');
  await page.waitForFunction(() => !document.getElementById('shell').hidden && document.documentElement.dataset.kind === 'kiosk', null, { timeout: 15000 });
  const tTv = Date.now(); await sleep(35000);
  log('D. kiosk online 35 s: hub.canWrite / sync', await page.evaluate(() => ({ canWrite: hub.canWrite, state: hub.sync.state, pulledAfterSignIn: hub.sync.lastPull > 0 })));
  log('D. kiosk: hub.activityQueue', await aq());
  log('D. server: Mae\'s feed line posted during kiosk?', (await feed()).filter(l => l.text.includes('Mae:')).length ? 'yes' : 'NO');
  // hand the iPad to Kiara (sign the TV out, reload to the picker, tap Kiara) and let her do one feed-writing action
  await page.evaluate(() => hub.signOut()); await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#profiles .pcard[data-id="kiara"]', { timeout: 15000 }); await tap('#profiles .pcard[data-id="kiara"]'); await waitProfile('kiara'); await sleep(1500);
  await page.evaluate(n => hub.activity('Kiara action ' + n, 'prayer'), NONCE); await sleep(2500);
  const fd = await feed();
  const maeLine = fd.find(l => l.text.includes('Mae: dentist'));
  log('D. VERDICT Mae\'s line attributed to', maeLine ? `${maeLine.by} (${maeLine.name}), ${Math.round((maeLine.created_at - tTv) / 1000)} s after the kiosk signed in` : 'not posted');
  log('D. all feed lines for this run', fd);
  R.logs = ipad.logs.filter(l => /error/i.test(l)).slice(-10);
  fs.writeFileSync(path.join(OUT, 'verify-activity-queue-misattributed-1.json'), JSON.stringify(R, null, 1));
  console.log('evidence: audits/evidence/p2/PROF/verify-activity-queue-misattributed-1.json');
} finally { await L.close(); }
