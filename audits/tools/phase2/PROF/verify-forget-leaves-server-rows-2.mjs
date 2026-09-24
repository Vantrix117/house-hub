// PROF skeptic #2: does "Forget this device" (Me → Sync) leave the device row, its sessions and its push subscriptions
// live on the server? Independent of pairing.mjs. Local rig only; throwaway pairing code; fake push endpoint (never sent:
// the rig stubs the Worker's outbound fetch and has no VAPID keys unless asked).
//
//   node "audits/tools/phase2/PROF/verify-forget-leaves-server-rows-2.mjs"
//
// Steps: pair a fresh iPhone through the UI → tap Ezra → register a push subscription for (ezra, this device) through the
// real route → Me → Forget (watch every request to the API during the tap) → ask the server what is left → use the old
// tokens → re-pair the same browser with the same name (ghost pile-up) → admin Unpair of the ghost (the existing mitigation).
import http from 'node:http';
import crypto from 'node:crypto';
import { local, sleep } from '../../lib/local.mjs';

const log = (k, v) => console.log(k.padEnd(60), typeof v === 'string' ? v : JSON.stringify(v));
// a stand-in push service on localhost (the rig lets the Worker reach other localhost ports): it only counts deliveries
const hits = [];
const push = http.createServer((req, res) => { let n = 0; req.on('data', c => n += c.length); req.on('end', () => { hits.push(`${req.method} ${req.url} ${n}B`); res.writeHead(201); res.end(); }); });
await new Promise(r => push.listen(0, '127.0.0.1', r));
const ENDPOINT = `http://127.0.0.1:${push.address().port}/push/forgotten-phone`;
const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
const SUB = { endpoint: ENDPOINT, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
const L = await local({ variant: 'typical', clock: 'real', vapid: true });
const CODE = 'rig-verify-4419';
const NAME = 'Verify phone';
const usage = async () => (await L.apiAs('eli', '/api/admin/usage')).body;
try {
  await L.setPairingCode(CODE);
  const d = await L.device({ device: 'iphone-pwa', profile: 'unpaired', fixedTime: false });
  const { page } = d;
  await d.goto(''); await page.waitForSelector('#pairform');
  await page.fill('#paircode', CODE); await page.fill('#pairname', NAME); await page.click('#pairform button[type=submit]');
  await page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 15000 });
  await page.click('#profiles .pcard[data-id="ezra"]');
  await page.waitForFunction(() => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === 'ezra', null, { timeout: 15000 });
  const dev = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.device')));
  const sess = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.session')));
  log('paired device id / session profile', `${dev.id} / ${sess.profile.id}`);

  // a push subscription row for (ezra, this device), as the Me toggle would write it
  const subR = await L.apiAs(null, '/api/push/subscribe', { method: 'POST', deviceToken: dev.token, profileToken: sess.token,
    body: { subscription: SUB } });
  const u0 = await usage();
  log('before Forget: POST /api/push/subscribe', String(subR.status));
  log('before Forget: devices named ' + NAME, u0.devices.filter(x => x.name === NAME).length);
  log('before Forget: push_subscriptions for ezra', (u0.push_subscriptions.find(x => x.profile_id === 'ezra') || { n: 0 }).n);

  // Forget, recording every request the page makes to the API while it runs
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#forget');
  // every request that is not a static file from the site (the local API, or production, which the rig aborts)
  const apiReqs = []; const onReq = r => { if (!r.url().startsWith(L.site)) apiReqs.push(r.method() + ' ' + r.url().replace(/\?.*$/, '')); };
  page.on('request', onReq);
  let dialog = null; page.once('dialog', x => { dialog = x.message(); x.accept(); });
  await page.click('#forget');
  await page.waitForSelector('#pairform', { timeout: 15000 });
  await sleep(1500);
  page.off('request', onReq);
  log('Forget: confirm() text', dialog);
  log('Forget: non-site requests from click to pairing screen', apiReqs.length ? apiReqs : 'none');
  log('Forget: hub.* keys left on the phone', await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.'))));

  const u1 = await usage();
  const row = u1.devices.find(x => x.id === dev.id);
  log('after Forget: device row still on server (admin Devices)', row ? `yes (${row.name}, last_seen ${new Date(row.last_seen).toISOString()})` : 'no');
  log('after Forget: push_subscriptions for ezra', (u1.push_subscriptions.find(x => x.profile_id === 'ezra') || { n: 0 }).n);
  const me = await L.apiAs(null, '/api/me', { deviceToken: dev.token, profileToken: sess.token });
  log('after Forget: GET /api/me with the discarded tokens', `${me.status} ${me.body.profile ? me.body.profile.id : me.body.error}`);
  const w = await L.apiAs(null, '/api/data/kidverse/verify.forget?scope=person', { method: 'PUT', deviceToken: dev.token, profileToken: sess.token, body: { value: { ghost: true }, updated_at: Date.now() } });
  log('after Forget: PUT person data with the discarded tokens', String(w.status));
  const devOnly = await L.apiAs(null, '/api/profiles', { deviceToken: dev.token, profileToken: null });
  log('after Forget: GET /api/profiles with the discarded device token', String(devOnly.status));
  // does the Worker still deliver Ezra's notifications to the forgotten phone's push endpoint? (admin test push to ezra)
  const pt = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: { profile_id: 'ezra' } });
  await sleep(300);
  log('after Forget: admin test push to ezra → Worker result', `${pt.status} sent=${pt.body.sent} ok=${pt.body.ok} ${JSON.stringify((pt.body.details || []).map(x => x.endpoint + ' ' + x.status))}`);
  log('after Forget: deliveries seen at the forgotten phone endpoint', hits);

  // re-pair the same browser with the same name. Forget also removed the rig's hub.api pointer (a hub.* key), so hub.js
  // would fall back to production (which the rig blocks); put the local API back first — a rig artefact, not the app's.
  await page.evaluate(api => localStorage.setItem('hub.api', JSON.stringify(api)), L.api);
  await d.goto(''); await page.waitForSelector('#pairform');
  await page.fill('#paircode', CODE); await page.fill('#pairname', NAME); await page.click('#pairform button[type=submit]');
  await page.waitForSelector('#profiles .pcard[data-id]', { timeout: 15000 });
  const dev2 = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.device')));
  const u2 = await usage();
  log('after re-pair: rows named ' + NAME, u2.devices.filter(x => x.name === NAME).map(x => x.id === dev.id ? 'old(ghost)' : x.id === dev2.id ? 'new' : 'other'));

  // mitigation: the admin can Unpair the ghost, which kills its sessions and push rows
  const un = await L.apiAs('eli', `/api/admin/devices/${dev.id}`, { method: 'DELETE' });
  const me2 = await L.apiAs(null, '/api/me', { deviceToken: dev.token, profileToken: sess.token });
  const u3 = await usage();
  log('admin Unpair of the ghost → status / old tokens now', `${un.status} / ${me2.status} ${me2.body.error}`);
  log('after admin Unpair: push_subscriptions for ezra', (u3.push_subscriptions.find(x => x.profile_id === 'ezra') || { n: 0 }).n);
  log('page errors', d.logs.filter(l => /pageerror/.test(l)));
} finally { await L.close(); push.close(); }
