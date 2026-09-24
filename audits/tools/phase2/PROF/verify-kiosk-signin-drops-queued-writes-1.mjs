// PROF skeptic #1 — finding "kiosk-signin-drops-queued-writes".
// Claim: an adult's offline family write, still queued when she taps Me → Switch, is thrown away when the Downstairs TV
// (kiosk) profile is signed in next on the same device: the kiosk's flush gets 403 read_only, hub.js empties the queue,
// and hub.sync ends up 'synced' with no error.
//
//   node "audits/tools/phase2/PROF/verify-kiosk-signin-drops-queued-writes-1.mjs"
//
// Three fresh device contexts on one local rig (typical seed, real clock, WebKit), all driven through the UI:
//   K1  Mae offline → reminder → Switch → back online at the picker → tap Downstairs TV   (the finding's path)
//   (the TV cannot be signed in while offline — /api/login needs the server — so K1 is the only kiosk path)
//   K1 then continues: TV's Switch → Ezra → Ezra's next hub.activity() drains Mae's queued feed line
//   C   control: same as K1 but Ezra (kid, tap-to-start) is tapped instead of the TV
// Evidence: audits/evidence/p2/PROF/verify-kiosk-signin-drops-queued-writes-1.json (+ one PNG).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real' });
const R = {};
const log = (k, v) => { console.log(k.padEnd(52), typeof v === 'string' ? v : JSON.stringify(v)); return v; };

async function run(tag, nextProfile, onlineBeforeTap) {
  const res = {};
  const d = await L.device({ device: 'ipad-portrait', profile: 'christian', fixedTime: false });
  const { page } = d;
  const net = [];
  page.on('response', async r => { const u = new URL(r.url()); if (u.origin === L.api && r.request().method() !== 'GET' && r.request().method() !== 'OPTIONS') { let b = null; try { b = await r.json(); } catch {} net.push({ at: Date.now(), m: r.request().method(), p: u.pathname + u.search, status: r.status(), err: b && b.error }); } });
  const ls = () => page.evaluate(() => ({ remindersQueue: JSON.parse(localStorage.getItem('hub.queue.reminders.family') || 'null'), activityQueue: JSON.parse(localStorage.getItem('hub.activityQueue') || 'null'), session: (JSON.parse(localStorage.getItem('hub.session') || 'null') || {}).profile?.id || null }));
  const text = `${tag} Mae offline: dentist 3pm`;

  await d.goto('#home');
  await page.waitForFunction(() => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === 'christian' && hub.sync.lastPull > 0, null, { timeout: 20000 });
  await page.waitForSelector('#remtext');
  await d.setOffline(true);
  await page.fill('#remtext', text); await page.press('#remtext', 'Enter'); await sleep(600);
  res.afterWrite = log(`${tag} after Mae's offline reminder: localStorage`, await ls());
  res.syncAfterWrite = log(`${tag} hub.sync (Mae)`, await page.evaluate(() => ({ ...hub.sync })));

  await page.locator('.tab[data-tab="me"]').click(); await page.waitForSelector('#switch'); await page.locator('#switch').click();
  await page.waitForSelector(`#profiles .pcard[data-id="${nextProfile}"]`, { timeout: 15000 });
  res.atPicker = log(`${tag} at picker (offline)`, await ls());
  if (onlineBeforeTap) { await d.setOffline(false); await sleep(1500); res.atPickerOnline = log(`${tag} at picker after back online (1.5 s)`, await ls()); }
  const netBeforeTap = net.length;
  await page.locator(`#profiles .pcard[data-id="${nextProfile}"]`).click();
  await page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, nextProfile, { timeout: 15000 });
  await sleep(3000);
  if (!onlineBeforeTap) {
    res.signedInOffline = log(`${tag} ${nextProfile} signed in, still offline`, await ls());
    await d.setOffline(false); await sleep(4000);
  }
  res.syncAfter = log(`${tag} hub.sync after ${nextProfile} signed in + online`, await page.evaluate(() => ({ ...hub.sync })));
  res.lsAfter = log(`${tag} localStorage after`, await ls());
  res.writesSent = log(`${tag} non-GET API calls after the tap`, net.slice(netBeforeTap));
  const items = ((await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items || []).filter(i => i.value && i.value.text === text);
  res.onServer = log(`${tag} server has "${text}"?`, items.length ? `YES (by ${items[0].value.byName}, updated_at ${items[0].updated_at})` : 'NO');
  const feed = (await L.apiAs('eli', '/api/activity?limit=100')).body.activity.filter(a => a.text.includes(text)).map(a => `${a.profile_id}: ${a.text}`);
  res.feed = log(`${tag} feed lines for it`, feed.length ? feed : 'none');
  res.statusText = log(`${tag} visible sync/offline indicator text`, await page.evaluate(() => { const el = document.querySelector('#syncdot, .syncdot, [data-sync]'); return el ? (el.getAttribute('title') || el.className || el.textContent) : 'no sync indicator element'; }));
  if (tag === 'K1') {
    const png = path.join(OUT, 'verify-kiosk-signin-drops-queued-writes-1-k1.png');
    await page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
    res.shot = path.relative(ROOT, png);
    // the next writer on this iPad: TV's Switch → Ezra, who does something that writes a feed line
    await page.locator('#kiosk-switch').click();
    await page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 15000 });
    await page.locator('#profiles .pcard[data-id="ezra"]').click();
    await page.waitForFunction(() => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === 'ezra', null, { timeout: 15000 });
    await sleep(2000);
    await page.evaluate(() => hub.activity('K1 Ezra did something'));
    await sleep(1500);
    res.feedAfterEzra = log(`${tag} feed lines after Ezra's next activity`, (await L.apiAs('eli', '/api/activity?limit=100')).body.activity.filter(a => a.text.includes('K1 ')).map(a => `${a.profile_id} (${a.name}): ${a.text}`));
    res.reminderAfterEzra = log(`${tag} server has Mae's reminder after Ezra signed in?`, ((await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items || []).some(i => i.value && i.value.text === text) ? 'YES' : 'NO');
  }
  await d.close();
  return res;
}

try {
  R.K1 = await run('K1', 'tv', true);
  R.C = await run('C', 'ezra', true);
  fs.writeFileSync(path.join(OUT, 'verify-kiosk-signin-drops-queued-writes-1.json'), JSON.stringify(R, null, 1));
  console.log('\nSUMMARY');
  for (const k of ['K1', 'C']) console.log(k, '| on server:', R[k].onServer, '| sync:', JSON.stringify({ state: R[k].syncAfter.state, pending: R[k].syncAfter.pending, lastError: R[k].syncAfter.lastError }), '| batch calls:', JSON.stringify(R[k].writesSent.filter(w => /batch/.test(w.p)).map(w => w.status + ' ' + (w.err || ''))), '| activityQueue:', JSON.stringify(R[k].lsAfter.activityQueue));
} finally { await L.close(); }
