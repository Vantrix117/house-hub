// Phase 2 / PWA — skeptic #1 for "offline-activity-misattributed".
//   node "audits/tools/phase2/PWA/verify-offline-activity-misattributed-1.mjs"
// Independent re-run on a fresh local instance with the REAL server clock (clock:'real'), so the server's created_at can be
// compared with the moment the action really happened (the demo clock is slowed and hides the time gap).
//   1. Kitchen iPad, Eli, Home. Go offline, add a reminder through the UI.  → hub.activityQueue holds the line.
//   2. Online again. Wait 40 s (the 'online' flush + one 30 s pull), then fire visibilitychange (app back to front),
//      then reload the page (app relaunched). After each: is the line on the server? is it still queued?
//   3. Me → Switch → Grandma Jo (PIN-less guest) → Home → she adds her own reminder.
//   4. Read the server feed: who is Eli's offline line credited to, and when is it stamped vs when Eli did it?
// Evidence: audits/evidence/p2/PWA/verify-offline-activity-misattributed-1.{json,txt} + a 1× shot of the feed.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const TAG = 'verify-offline-activity-misattributed-1';
const log = {}; const lines = [];
const say = (k, v) => { log[k] = v; const s = '\n== ' + k + '\n' + (typeof v === 'string' ? v : JSON.stringify(v, null, 1)); lines.push(s); console.log(s); };
const iso = ms => new Date(ms).toISOString();

const OFF = 'Verify offline: fix the gate latch';
const GUEST = 'Verify: guest reminder';

const L = await local({ variant: 'typical', clock: 'real' });
try {
  // a second device used only to read the server (the iPad's Eli session is revoked by Switch → /api/logout)
  const ph = await L.newDevice({ name: 'Skeptic reader', profiles: ['mom'] });
  const feed = async () => (await L.apiAs('mom', '/api/activity?limit=200', { deviceToken: ph.device.token, profileToken: ph.sessions.mom })).body.activity;
  const reminders = async () => (await L.apiAs('mom', '/api/data/reminders?scope=family', { deviceToken: ph.device.token, profileToken: ph.sessions.mom })).body.items || [];
  const findLine = async t => (await feed()).filter(a => a.text === t).map(a => ({ profile_id: a.profile_id, name: a.name, created_at: iso(a.created_at) }));

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const P = ipad.page;
  const queue = () => P.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]'));
  await ipad.goto('#home'); await P.waitForSelector('#remtext');
  say('0 signed in on the iPad', await P.evaluate(() => ({ profile: hub.profile && hub.profile.id, queue: JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').length })));

  // 1. offline add
  await ipad.setOffline(true);
  const tAction = Date.now();
  await P.fill('#remtext', OFF); await P.press('#remtext', 'Enter');
  await sleep(800);
  say('1 Eli adds a reminder offline', { tAction: iso(tAction), navigatorOnLine: await P.evaluate(() => navigator.onLine), queue: (await queue()).map(q => ({ app_id: q.app_id, text: q.text, at: iso(q.at) })) });

  // 2. online; wait past one 30 s pull
  await ipad.setOffline(false);
  await sleep(40000);
  const item = (await reminders()).find(i => i.value && i.value.text === OFF);
  say('2a 40 s after coming back online', { reminderItemOnServer: !!item, reminderBy: item && item.value.by, lineOnServer: await findLine('Added a reminder: ' + OFF), stillQueued: (await queue()).map(q => q.text), lastPull: iso((await ipad.hub()).sync.lastPull || 0), syncState: (await ipad.hub()).sync.state });
  await P.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(3000);
  say('2b after visibilitychange (app brought back to front)', { lineOnServer: await findLine('Added a reminder: ' + OFF), stillQueued: (await queue()).map(q => q.text) });
  await P.reload(); await P.waitForSelector('#remtext', { timeout: 20000 }); await sleep(5000);
  say('2c after reloading the page (app relaunched)', { profile: await P.evaluate(() => hub.profile && hub.profile.id), lineOnServer: await findLine('Added a reminder: ' + OFF), stillQueued: (await queue()).map(q => q.text) });

  // 3. switch to Grandma Jo and add her own reminder
  await ipad.goto('#me'); await P.waitForSelector('#switch'); await P.click('#switch');
  await P.waitForSelector('.pcard[data-id="guest-grandmajo"]', { timeout: 15000 }); await sleep(500);
  await P.click('.pcard[data-id="guest-grandmajo"]');
  await P.waitForSelector('.tab[data-tab="home"]', { state: 'visible', timeout: 15000 }); await P.click('.tab[data-tab="home"]');
  await P.waitForSelector('#remtext', { state: 'visible', timeout: 15000 });
  say('3a after Switch → Grandma Jo (before she does anything)', { profile: await P.evaluate(() => hub.profile && hub.profile.id), lineOnServer: await findLine('Added a reminder: ' + OFF), stillQueued: (await queue()).map(q => q.text) });
  const tGuest = Date.now();
  await P.fill('#remtext', GUEST); await P.press('#remtext', 'Enter');
  await sleep(2500);

  // 4. what the server holds
  const off = await findLine('Added a reminder: ' + OFF);
  const g = await findLine('Added a reminder: ' + GUEST);
  const item2 = (await reminders()).find(i => i.value && i.value.text === OFF);
  say('4 server feed after Grandma Jo adds her reminder', {
    eliOfflineLine: off, grandmaLine: g, queueAfter: (await queue()).map(q => q.text),
    reminderItemBy: item2 && item2.value.by, reminderItemByName: item2 && item2.value.byName,
    eliActedAt: iso(tAction), grandmaActedAt: iso(tGuest),
    stampLagSeconds: off[0] ? Math.round((Date.parse(off[0].created_at) - tAction) / 1000) : null,
  });
  await P.click('#feed-refresh'); await sleep(2000);
  const shot = path.join(OUT, TAG + '-feed-ipad-portrait-light.png');
  await P.locator('#feed').first().screenshot({ path: shot, scale: 'css', animations: 'disabled' });
  say('shot', path.relative(ROOT, shot).replace(/\\/g, '/'));
  say('feed text on the iPad', await P.$$eval('#feed .fline', els => els.slice(0, 6).map(e => e.textContent.replace(/\s+/g, ' ').trim())));
} finally {
  fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(log, null, 1));
  fs.writeFileSync(path.join(OUT, TAG + '.txt'), lines.join('\n') + '\n');
  await L.close();
}
