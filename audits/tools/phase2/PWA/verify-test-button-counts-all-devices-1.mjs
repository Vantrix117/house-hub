// Phase 2 / PWA — skeptic #1 for finding "test-button-counts-all-devices".
//   node "audits/tools/phase2/PWA/verify-test-button-counts-all-devices-1.mjs"
// Claim: Me → "Send a test notification" (POST /api/push/test) counts every push subscription of the profile, so a
// press on one device reports "Sent — it should appear in a moment." when only ANOTHER device of that person got it.
// Local rig only (never production): a stand-in push service (scripts/push-receiver.mjs) on a free port, a throwaway
// VAPID pair (local({ vapid: true })), subscriptions registered through the real POST /api/push/subscribe with
// per-device endpoint paths (/push/<label>) so the receiver log shows which device got each push.
// Scenarios:
//   A  API only, the investigator's case: Eli has no row on the Kitchen iPad, one on his phone; test pressed on the iPad.
//   B  The UI path on a shared Kitchen iPad: Mom turned notifications on there (the browser's single PushSubscription
//      exists, so for Eli renderNotif() shows "On for this device" + the test button, because it only asks
//      pushManager.getSubscription() and never re-registers it for the signed-in profile); Eli's row is on his phone
//      only. The rig serves http, so pushSupported() is false and paint() never runs: the script un-hides #notif-prefs
//      (exactly what paint() does when a browser subscription exists) and clicks the real #notif-test button.
//   C  Eli IS registered on the iPad but that endpoint fails (unreachable push service, status 0), phone fine.
//   D  Both registered and fine: pressing on the iPad also buzzes the phone.
// Writes audits/evidence/p2/PWA/verify-test-button-counts-all-devices-1.json (+ one 1x PNG of scenario B's toast).
import { local, sleep } from '../../lib/local.mjs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

const rxPort = await freePort();
const rx = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
let baseSub = null; const pushes = []; let buf = '';
rx.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
    const m = /^PUSH #\d+ url=(\S+) vapid=(\S+).* payload=(.*)$/.exec(line);
    if (m) { let p; try { p = JSON.parse(m[3]); } catch { p = m[3]; } pushes.push({ to: m[1].split('/').pop(), vapid: m[2], body: p.body }); }
  }
});
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) { rx.kill(); throw new Error('push receiver did not start'); }
const sub = label => ({ ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${label}` });
let mark = 0;
const got = async () => { await sleep(700); const n = pushes.slice(mark); mark = pushes.length; return n; };

const L = await local({ variant: 'typical', clock: 'real', vapid: true });   // real clock: the VAPID JWT's exp is then valid at the receiver
const out = { receiverPort: rxPort, scenarios: {} };
const log = (k, v) => { out.scenarios[k] = v; console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); };
const rows = async () => (await L.apiAs('eli', '/api/admin/usage')).body.push_subscriptions;
const uiToast = t => t.body.sent ? (t.body.ok ? 'Sent — it should appear in a moment.' : 'The push service refused it: …') : 'No subscription on the server for this device yet.';

try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const onPhone = { deviceToken: ph.device.token, profileToken: ph.sessions.eli };
  // Clean slate for Eli and Mom on the Kitchen iPad
  await L.apiAs('eli', '/api/push/subscribe', { method: 'DELETE' });
  await L.apiAs('mom', '/api/push/subscribe', { method: 'DELETE' });
  const phoneSub = await L.apiAs('eli', '/api/push/subscribe', { method: 'POST', body: { subscription: sub('eli-phone') }, ...onPhone });

  // ── A: API only ──
  await got();
  const tA = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: {} });
  log('A: test pressed on the Kitchen iPad, Eli registered only on his phone (API)', { phoneSubscribe: phoneSub.status, subsPerProfile: await rows(), status: tA.status, body: tA.body, received: await got(), toastTheUiWouldShow: uiToast(tA) });

  // ── B: UI path on the shared iPad (Mom's browser subscription) ──
  const momSub = await L.apiAs('mom', '/api/push/subscribe', { method: 'POST', body: { subscription: sub('kitchen-ipad') } });   // what Mom's toggle POSTs
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await ipad.goto('#me');
  await ipad.page.waitForSelector('#notif-test', { state: 'attached', timeout: 15000 });
  await sleep(800);
  const before = await ipad.page.evaluate(() => ({ profile: hub.profile.id, prefsHidden: document.getElementById('notif-prefs').hidden, help: document.getElementById('notif-help').textContent, protocol: location.protocol }));
  await ipad.page.evaluate(() => { document.getElementById('notif-prefs').hidden = false; });   // = paint() with a browser subscription present
  await got();
  const resP = ipad.page.waitForResponse(r => r.url().includes('/api/push/test'), { timeout: 10000 });
  await ipad.page.click('#notif-test');
  const res = await resP; const resBody = await res.json();
  await ipad.page.waitForFunction(() => { const t = document.getElementById('hub-toast'); return t && t.textContent.trim(); }, null, { timeout: 5000 }).catch(() => {});
  const toast = await ipad.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t ? t.textContent.trim() : null; });
  const png = path.join(OUT, 'verify-test-button-counts-all-devices-1-B-ipad-portrait-light.png');
  await ipad.page.evaluate(() => { const c = document.getElementById('notif'); if (c) c.scrollIntoView({ block: 'center' }); });
  await ipad.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
  log('B: shared Kitchen iPad — Mom has notifications on there; Eli presses the real #notif-test button', { momSubscribe: momSub.status, subsPerProfile: await rows(), rigBeforeUnhide: before, response: resBody, received: await got(), toastShown: toast, screenshot: path.relative(ROOT, png) });

  // ── C: Eli registered on the iPad but that endpoint fails; phone fine ──
  const closed = await freePort();
  await L.apiAs('eli', '/api/push/subscribe', { method: 'POST', body: { subscription: { ...baseSub, endpoint: `http://127.0.0.1:${closed}/push/eli-ipad-dead` } } });
  await got();
  const tC = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: {} });
  log('C: Eli registered on the iPad (endpoint unreachable) + phone; test pressed on the iPad', { status: tC.status, body: tC.body, received: await got(), toastTheUiWouldShow: uiToast(tC) });

  // ── D: both fine ──
  await L.apiAs('eli', '/api/push/subscribe', { method: 'POST', body: { subscription: sub('eli-ipad') } });
  await got();
  const tD = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: {} });
  log('D: Eli registered on iPad + phone, both fine; test pressed on the iPad', { status: tD.status, body: tD.body, received: await got() });
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-test-button-counts-all-devices-1.json'), JSON.stringify(out, null, 1));
  await L.close(); rx.kill();
}
