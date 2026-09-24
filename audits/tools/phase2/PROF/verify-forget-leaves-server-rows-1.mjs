// PROF skeptic #1 for "forget-leaves-server-rows": does Me → Sync → "Forget this device" leave the device row, its
// sessions and its push subscriptions live on the server? Independent of pairing.mjs.
//
//   node "audits/tools/phase2/PROF/verify-forget-leaves-server-rows-1.mjs"
//
// Local rig only (throwaway pairing code, throwaway VAPID pair, a push "service" on 127.0.0.1 inside this script).
// Steps: pair a phone through the real /api/pair; Ezra (tap) and David (admin resets his PIN, he creates one on the phone)
// sign in there; David subscribes to push with an endpoint on the local receiver; open the phone's shell as David,
// record every API request made while tapping Forget; then ask the server what is left, send David a push, and finally
// show the admin Unpair route does clear it all (the control).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const log = (k, v) => console.log(k.padEnd(60), typeof v === 'string' ? v : JSON.stringify(v));
const result = {};

// a stand-in push service: records every POST it receives
const received = [];
const recv = http.createServer((req, res) => { const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => { received.push({ path: req.url, method: req.method, bytes: Buffer.concat(chunks).length, at: Date.now() }); res.writeHead(201); res.end(); }); });
await new Promise(r => recv.listen(0, '127.0.0.1', r));
const RPORT = recv.address().port;
const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
const subscription = { endpoint: `http://127.0.0.1:${RPORT}/push/forgotten-phone`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };

const L = await local({ variant: 'typical', clock: 'real', vapid: true });
const CODE = 'skeptic-throwaway-4419';
const usage = async () => (await L.apiAs('eli', '/api/admin/usage')).body;
try {
  await L.setPairingCode(CODE);
  // 1. pair a phone the real way
  const pair = await L.apiAs(null, '/api/pair', { method: 'POST', body: { code: CODE, name: 'Skeptic phone' }, deviceToken: null });
  const dev = { id: pair.body.device_id, token: pair.body.device_token, name: 'Skeptic phone' };
  log('pair status', String(pair.status));
  // 2. sign in Ezra (tap) and David (fresh PIN) on that phone
  const ez = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'ezra' }, deviceToken: dev.token });
  const rp = await L.apiAs('eli', '/api/admin/profiles/dad/reset-pin', { method: 'POST', body: {} });
  const da = await L.apiAs(null, '/api/profiles/dad/pin', { method: 'POST', body: { pin: '2468' }, deviceToken: dev.token });
  log('ezra login / admin reset dad / dad creates PIN', `${ez.status} / ${rp.status} / ${da.status}`);
  const sub = await L.apiAs(null, '/api/push/subscribe', { method: 'POST', body: { subscription }, deviceToken: dev.token, profileToken: da.body.profile_token });
  log('dad push subscribe on the phone', String(sub.status));
  const before = await usage();
  result.before = { deviceListed: before.devices.some(d => d.id === dev.id), dadSubs: (before.push_subscriptions.find(s => s.profile_id === 'dad') || {}).n || 0 };
  log('before Forget: device listed / dad push subs', `${result.before.deviceListed} / ${result.before.dadSubs}`);

  // 3. the phone's shell, signed in as David; tap Forget and record every API request
  const ph = await L.device({ device: 'iphone-pwa', profile: 'dad', fixedTime: false, as: { device: dev, sessions: { dad: da.body.profile_token } } });
  const { page } = ph;
  await ph.goto('#me'); await page.waitForSelector('#forget', { timeout: 15000 });
  await page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'dad');
  const apiReqs = []; page.on('request', r => { if (r.url().startsWith(L.api)) apiReqs.push(r.method() + ' ' + new URL(r.url()).pathname); });
  await sleep(1500); apiReqs.length = 0;   // let the Me tab's own loads settle; only count what Forget does
  let dialog = null; page.once('dialog', d => { dialog = d.message(); d.accept(); });
  await page.click('#forget');
  await page.waitForSelector('#pairform', { timeout: 15000 });
  const duringForget = [...apiReqs];
  result.dialog = dialog; result.apiRequestsFromForget = duringForget;
  result.hubKeysLeft = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.')));
  log('Forget dialog', dialog);
  log('API requests made by Forget (until the pairing screen)', duringForget);
  log('hub.* keys left in localStorage', result.hubKeysLeft);
  await page.screenshot({ path: path.join(OUT, 'verify-forget-leaves-server-rows-1-after.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  // 4. what the server still holds
  const after = await usage();
  result.after = { deviceListed: after.devices.some(d => d.id === dev.id), dadSubs: (after.push_subscriptions.find(s => s.profile_id === 'dad') || {}).n || 0 };
  const meEz = await L.apiAs(null, '/api/me', { deviceToken: dev.token, profileToken: ez.body.profile_token });
  const meDa = await L.apiAs(null, '/api/me', { deviceToken: dev.token, profileToken: da.body.profile_token });
  const wr = await L.apiAs(null, '/api/data/leftovers/item:skeptic-ghost?scope=family', { method: 'PUT', body: { value: { name: 'written with forgotten tokens' }, updated_at: Date.now() }, deviceToken: dev.token, profileToken: da.body.profile_token });
  result.after.meEzra = meEz.status + ' ' + (meEz.body.profile ? meEz.body.profile.id : meEz.body.error);
  result.after.meDad = meDa.status + ' ' + (meDa.body.profile ? meDa.body.profile.id : meDa.body.error);
  result.after.writeWithOldTokens = wr.status;
  log('after Forget: device still in Admin → Devices list', String(result.after.deviceListed));
  log('after Forget: /api/me with old device + Ezra session', result.after.meEzra);
  log('after Forget: /api/me with old device + David session', result.after.meDad);
  log('after Forget: family write with old device + David session', String(wr.status));
  log('after Forget: David push subscriptions on server', String(result.after.dadSubs));
  // 5. a push to David still goes to the forgotten phone's endpoint
  received.length = 0;
  const pt = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: { profile_id: 'dad' } });
  await sleep(500);
  result.after.pushTest = { status: pt.status, body: pt.body, receiverHits: received.map(r => r.path + ' ' + r.bytes + 'B') };
  log('after Forget: push to David → sent/ok', `${pt.status} sent=${pt.body.sent} ok=${pt.body.ok}`);
  log('after Forget: local push service received', result.after.pushTest.receiverHits);

  // 6. control: the admin's Unpair does clean all three up
  const un = await L.apiAs('eli', `/api/admin/devices/${dev.id}`, { method: 'DELETE' });
  const ctl = await usage();
  const meCtl = await L.apiAs(null, '/api/me', { deviceToken: dev.token, profileToken: ez.body.profile_token });
  result.control = { unpair: un.status, deviceListed: ctl.devices.some(d => d.id === dev.id), dadSubs: (ctl.push_subscriptions.find(s => s.profile_id === 'dad') || {}).n || 0, me: meCtl.status + ' ' + (meCtl.body.error || '') };
  log('control: admin Unpair → listed / dad subs / old tokens', `${un.status} → ${result.control.deviceListed} / ${result.control.dadSubs} / ${result.control.me}`);
  // tidy the ghost family row the check wrote
  await L.apiAs('eli', '/api/data/leftovers/item:skeptic-ghost?scope=family', { method: 'DELETE' });
  fs.writeFileSync(path.join(OUT, 'verify-forget-leaves-server-rows-1.json'), JSON.stringify(result, null, 2));
  log('evidence', 'audits/evidence/p2/PROF/verify-forget-leaves-server-rows-1.json + -after.png');
} finally { await L.close(); recv.close(); }
