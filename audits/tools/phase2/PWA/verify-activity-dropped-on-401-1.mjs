// Phase 2 / PWA — skeptic #1 for finding "activity-dropped-on-401": a queued feed line is dropped for good on a 401.
//   node "audits/tools/phase2/PWA/verify-activity-dropped-on-401-1.mjs"
// Independent re-run on a fresh local instance, plus the variants that decide whether it happens in real use:
//   S1  the investigator's sequence: two lines queued offline, session revoked (POST /api/logout with that token), back
//       online, a third hub.activity() call right away → which lines survive, what reached the server, gate shown?
//   S1b the survivors: the next person (Mom) signs in on the same phone and adds a reminder → whose name do they carry?
//   S2  the natural reconnect: same as S1 but NO new hub.activity() after going online (the 'online' pull/flush runs
//       first) → is anything dropped?
//   S3  online revocation (admin Me → Admin → Reset PIN on Mom) while Mom's phone sits on Home; Mom adds a reminder
//       through the real form → is the feed line dropped while the reminder itself is kept? Then Mom creates a new PIN
//       (hub.createPin, what the picker calls) and reopens Home → does the reminder reach the server, does the line?
// Evidence: audits/evidence/p2/PWA/verify-activity-dropped-on-401-1.json / .txt
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const log = {}; const lines = [];
const say = (k, v) => { log[k] = v; const s = '\n== ' + k + '\n' + (typeof v === 'string' ? v : JSON.stringify(v, null, 1)); lines.push(s); console.log(s); };

const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const feed = async re => (await L.apiAs('eli', '/api/activity?limit=200')).body.activity.filter(a => re.test(a.text)).map(a => ({ who: a.profile_id, text: a.text }));
  const aq = page => page.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').map(q => q.text));
  const gate = page => page.evaluate(() => !document.querySelector('#gate').hidden);

  // ── S1 the investigator's sequence ─────────────────────────────────────────────
  const ph1 = await L.newDevice({ name: 'Verify phone 1', profiles: ['eli', 'mom'] });
  const p1 = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph1 });
  await p1.goto('#home'); await p1.page.waitForSelector('#remtext');
  await sleep(1500);
  await p1.setOffline(true);
  await p1.page.evaluate(() => { hub.activity('V401 S1 line 1'); hub.activity('V401 S1 line 2'); });
  await sleep(500);
  const s1Before = await aq(p1.page);
  const s1Logout = await L.apiAs('eli', '/api/logout', { method: 'POST', body: {}, deviceToken: ph1.device.token, profileToken: ph1.sessions.eli });
  const s1Check = await L.apiAs('eli', '/api/me', { deviceToken: ph1.device.token, profileToken: ph1.sessions.eli });
  await p1.setOffline(false);
  const s1Call = await p1.page.evaluate(() => hub.activity('V401 S1 line 3').then(() => 'resolved', e => 'rejected ' + e)).catch(e => String(e));
  await sleep(3000);
  say('S1 two lines queued offline, session revoked, online, a third hub.activity() at once', {
    queuedBefore: s1Before, logoutStatus: s1Logout.status, revokedTokenNow: s1Check.status + ' ' + (s1Check.body && s1Check.body.error),
    thirdCall: s1Call, queueAfter: await aq(p1.page), onServer: await feed(/V401 S1/), gateShown: await gate(p1.page),
    profileAfter: await p1.page.evaluate(() => hub.profile && hub.profile.id),
  });

  // ── S1b the survivors under the next person ───────────────────────────────────
  const momMe = await L.apiAs('mom', '/api/me', { deviceToken: ph1.device.token, profileToken: ph1.sessions.mom });
  await p1.page.evaluate(s => localStorage.setItem('hub.session', JSON.stringify(s)), { token: ph1.sessions.mom, profile: momMe.body.profile });
  await p1.goto('#home'); await p1.page.waitForSelector('#remtext', { state: 'visible', timeout: 15000 }); await sleep(1000);
  await p1.page.fill('#remtext', 'V401 S1b mom reminder'); await p1.page.press('#remtext', 'Enter');
  await sleep(3000);
  say('S1b Mom signs in on the same phone and adds a reminder', { signedInAs: await p1.page.evaluate(() => hub.profile && hub.profile.id), queueAfter: await aq(p1.page), onServer: await feed(/V401 S1/) });

  // ── S2 natural reconnect: no hub.activity() after coming online ───────────────
  const ph2 = await L.newDevice({ name: 'Verify phone 2', profiles: ['eli'] });
  const p2 = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph2 });
  await p2.goto('#home'); await p2.page.waitForSelector('#remtext');
  await sleep(1500);
  await p2.setOffline(true);
  await p2.page.evaluate(() => { hub.activity('V401 S2 line 1'); hub.activity('V401 S2 line 2'); });
  await sleep(500);
  const s2Before = await aq(p2.page);
  await L.apiAs('eli', '/api/logout', { method: 'POST', body: {}, deviceToken: ph2.device.token, profileToken: ph2.sessions.eli });
  await p2.setOffline(false);
  await sleep(4000);
  say('S2 same, but nothing calls hub.activity() after coming online', { queuedBefore: s2Before, queueAfter: await aq(p2.page), onServer: await feed(/V401 S2/), gateShown: await gate(p2.page) });

  // ── S3 online: admin resets Mom's PIN while her phone is on Home; she adds a reminder ──
  const ph3 = await L.newDevice({ name: 'Verify phone 3', profiles: ['mom'] });
  const p3 = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: ph3 });
  await p3.goto('#home'); await p3.page.waitForSelector('#remtext');
  await sleep(1500);
  const reset = await L.apiAs('eli', '/api/admin/profiles/mom/reset-pin', { method: 'POST', body: {} });
  await p3.page.fill('#remtext', 'V401 S3 fix the gate'); await p3.page.press('#remtext', 'Enter');
  await sleep(3000);
  const reminders = async () => ((await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items || []).filter(i => i.value && /V401 S3/.test(i.value.text || '')).map(i => i.value.text);
  const s3queues = await p3.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.queue.reminders')).map(k => [k, Object.values(JSON.parse(localStorage.getItem(k))).map(v => v && v.v && v.v.text || v && v.value && v.value.text || JSON.stringify(v).slice(0, 80))])));
  say('S3 admin reset Mom\'s PIN (sessions deleted); Mom adds a reminder on her open Home', {
    resetStatus: reset.status, activityQueueAfter: await aq(p3.page), feedOnServer: await feed(/V401 S3/), reminderOnServer: await reminders(),
    reminderWriteQueue: s3queues, gateShown: await gate(p3.page),
  });
  const pin = await p3.page.evaluate(() => hub.createPin('mom', '2468').then(p => 'signed in as ' + p.id, e => 'failed ' + (e.error || e)));
  await p3.goto('#home'); await p3.page.waitForSelector('#remtext', { state: 'visible', timeout: 15000 });
  await sleep(4000);
  say('S3 Mom creates a new PIN and reopens Home', { createPin: pin, activityQueue: await aq(p3.page), feedOnServer: await feed(/V401 S3/), reminderOnServer: await reminders() });
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-activity-dropped-on-401-1.json'), JSON.stringify(log, null, 1));
  fs.writeFileSync(path.join(OUT, 'verify-activity-dropped-on-401-1.txt'), lines.join('\n') + '\n');
  console.log('\nwrote audits/evidence/p2/PWA/verify-activity-dropped-on-401-1.{json,txt}');
  await L.close();
}
