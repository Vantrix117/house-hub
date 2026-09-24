// Skeptic #2 for finding "activity-dropped-on-401": a queued feed line is dropped for good when its POST returns 401.
// Three sequences on the local instance (fresh rig each time, nothing touches production):
//   A  the investigator's order: offline, queue 2 lines, session revoked, back online and a 3rd hub.activity() at once.
//   B  the natural order: same, but nobody writes for 3 s after reconnecting (the 'online' handler's pull meets the 401 first).
//   C  online all along: the admin resets Mom's PIN from the Kitchen iPad (sessions deleted, worker/src/index.js:445-450),
//      then Mom adds a reminder on her phone's Home before the 30 s pull notices. Does the reminder survive while its feed line does not?
// Run: node "audits/tools/phase2/PWA/verify-activity-dropped-on-401-2.mjs"
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const log = {};
const say = (k, v) => { log[k] = v; console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); };
const aq = p => p.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').map(q => q.text));

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const feed = async (re) => (await L.apiAs('eli', '/api/activity?limit=100')).body.activity.filter(a => re.test(a.text)).map(a => ({ who: a.profile_id, text: a.text }));

  // ── A: investigator's order ─────────────────────────────────────────────
  {
    const ph = await L.newDevice({ name: 'Eli phone A', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    await d.goto('#home'); await d.page.waitForSelector('#remtext'); await sleep(1500);
    await d.setOffline(true);
    await d.page.evaluate(() => { hub.activity('VerA line 1'); hub.activity('VerA line 2'); });
    await sleep(300);
    const before = await aq(d.page);
    const revoke = await L.apiAs('eli', '/api/logout', { method: 'POST', body: {}, deviceToken: ph.device.token, profileToken: ph.sessions.eli });
    await d.setOffline(false);
    const r3 = await d.page.evaluate(() => hub.activity('VerA line 3').then(() => 'ok', e => String(e)));
    await sleep(2500);
    say('A offline queue, revoke, online + immediate activity()', { queuedBefore: before, logoutStatus: revoke.status, activity3: r3, queueAfter: await aq(d.page), onServer: await feed(/VerA/), canWrite: await d.page.evaluate(() => hub.canWrite), gateShown: await d.page.evaluate(() => !document.querySelector('#gate').hidden) });
    await d.close();
  }

  // ── B: natural order — wait after reconnecting ────────────────────────────
  {
    const ph = await L.newDevice({ name: 'Eli phone B', profiles: ['eli', 'mom'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    await d.goto('#home'); await d.page.waitForSelector('#remtext'); await sleep(1500);
    await d.setOffline(true);
    await d.page.evaluate(() => { hub.activity('VerB line 1'); hub.activity('VerB line 2'); });
    await sleep(300);
    const before = await aq(d.page);
    await L.apiAs('eli', '/api/logout', { method: 'POST', body: {}, deviceToken: ph.device.token, profileToken: ph.sessions.eli });
    await d.setOffline(false);
    await sleep(3000);
    const mid = { queueAfterReconnect: await aq(d.page), onServer: await feed(/VerB/), canWrite: await d.page.evaluate(() => hub.canWrite), gateShown: await d.page.evaluate(() => !document.querySelector('#gate').hidden), lastError: (await d.hub()).sync.lastError };
    // Mom signs in on the same phone and writes one line: what happens to Eli's survivors?
    const me = await L.apiAs('mom', '/api/me', { deviceToken: ph.device.token, profileToken: ph.sessions.mom });
    await d.page.evaluate(s => { hub.setSession(s); return hub.activity('VerB Mom line'); }, { token: ph.sessions.mom, profile: me.body.profile });
    await sleep(1500);
    say('B offline queue, revoke, online, wait 3 s (no write)', { queuedBefore: before, ...mid, afterMomWrites: { queue: await aq(d.page), onServer: await feed(/VerB/) } });
    await d.close();
  }

  // ── C: online, admin resets Mom's PIN, Mom adds a reminder on Home ─────────
  {
    const ph = await L.newDevice({ name: 'Mom phone C', profiles: ['mom'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: ph });
    await d.goto('#home'); await d.page.waitForSelector('#remtext'); await sleep(2000);
    const reset = await L.apiAs('eli', '/api/admin/profiles/mom/reset-pin', { method: 'POST', body: {} });
    await d.page.fill('#remtext', 'VerC buy stamps');
    await d.page.press('#remtext', 'Enter');
    await sleep(2500);
    const reminderQueued = await d.page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('hub.queue.reminders.family') || '{}')).map(q => q.value && q.value.text));
    const serverRem = async () => Object.values(((await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items) || {}).length !== undefined
      ? JSON.stringify((await L.apiAs('eli', '/api/data/reminders?scope=family')).body).includes('VerC buy stamps') : null;
    const c1 = { resetStatus: reset.status, activityQueue: await aq(d.page), reminderInLocalQueue: reminderQueued, feedOnServer: await feed(/VerC/), reminderOnServer: await serverRem(), gateShown: await d.page.evaluate(() => !document.querySelector('#gate').hidden), lastError: (await d.hub()).sync.lastError };
    // Mom creates a new PIN (what the picker asks after a reset) and Home reloads
    const pin = await d.page.evaluate(() => hub.createPin('mom', '482915').then(p => p.id, e => String(e)));
    await d.goto('#home'); await d.page.waitForSelector('#remtext'); await sleep(3000);
    say('C online, admin resets Mom PIN, Mom adds a reminder', { beforeSignIn: c1, newPin: pin, afterSignIn: { activityQueue: await aq(d.page), feedOnServer: await feed(/VerC/), reminderOnServer: await serverRem() } });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-activity-dropped-on-401-2.json'), JSON.stringify(log, null, 1));
  console.log('\nwrote audits/evidence/p2/PWA/verify-activity-dropped-on-401-2.json');
  await L.close();
}
