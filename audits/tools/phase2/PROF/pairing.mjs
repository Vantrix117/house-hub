// PROF (audit Phase 2), brief item 5: device pairing. Pair a new phone through the UI with a throwaway code, the wrong-code
// and rate-limit paths, "Forget this device" (what it leaves on the server, what it throws away), rotating the code,
// and the admin's Unpair. Local rig only; the code is set with the rig's /__rig/pairing-code and is not a real one.
//
//   node "audits/tools/phase2/PROF/pairing.mjs"
//
// Evidence: audits/evidence/p2/PROF/pairing-*.png and the printed observations.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f); };
const log = (k, v) => console.log(k.padEnd(52), typeof v === 'string' ? v : JSON.stringify(v));
const L = await local({ variant: 'typical', clock: 'real' });
const CODE = 'rig-throwaway-7731';
const devices = async () => (await L.apiAs('eli', '/api/admin/usage')).body.devices.map(d => d.name);
try {
  await L.setPairingCode(CODE);
  log('devices before', await devices());

  // ── pair a new iPhone through the UI ──
  const ph = await L.device({ device: 'iphone-pwa', profile: 'unpaired', fixedTime: false }); const { page } = ph;
  await ph.goto(''); await page.waitForSelector('#pairform');
  log('pairing screen: fields', await page.evaluate(() => [...document.querySelectorAll('#pairform .label')].map(l => l.textContent) + ' | default name=' + document.getElementById('pairname').value));
  await page.fill('#paircode', 'wrong-code-1'); await page.click('#pairform button[type=submit]'); await sleep(800);
  log('wrong code →', await page.textContent('#pairmsg'));
  await page.fill('#paircode', CODE); await page.fill('#pairname', "Ezra's old iPhone"); await page.click('#pairform button[type=submit]');
  await page.waitForSelector('#profiles .pcard[data-id]', { timeout: 15000 });
  log('right code → picker, devices now', await devices());
  const newDev = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.device')));

  // ── Forget this device, as Ezra, with an unsent write queued ──
  await page.click('#profiles .pcard[data-id="ezra"]'); await page.waitForFunction(() => !document.getElementById('shell').hidden && hub.profile && hub.profile.id === 'ezra');
  const oldSession = await page.evaluate(() => hub.session.token);
  await ph.setOffline(true);
  await page.evaluate(() => hub.set('stars.note', { from: 'offline kid write' }, { app: 'kidverse', scope: 'person' }));
  const q = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.queue.') && localStorage.getItem(k) !== '{}'));
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#forget');
  log('Me as Ezra (kid): Forget this device offered?', String(await page.isVisible('#forget')) + ' | queued before tap: ' + JSON.stringify(q));
  await shot(ph, 'pairing-forget-kid-me.png');
  let dialog = null; page.once('dialog', d => { dialog = d.message(); d.accept(); });
  await page.click('#forget'); await page.waitForSelector('#pairform', { timeout: 15000 });
  log('after Forget: dialog text', dialog);
  log('after Forget: hub.* keys left on the phone', await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.'))));
  await ph.setOffline(false);
  log('after Forget: server still lists the device?', (await devices()).includes("Ezra's old iPhone") ? 'yes' : 'no');
  const still = await L.apiAs(null, '/api/me', { deviceToken: newDev.token, profileToken: oldSession });
  log('after Forget: old device + session tokens', `${still.status} ${still.body.profile ? 'still valid for ' + still.body.profile.id : still.body.error}`);
  await shot(ph, 'pairing-after-forget.png');
  await ph.close();

  // ── rotate the code (admin) ──
  const rot = await L.apiAs('eli', '/api/admin/pairing-code/rotate', { method: 'POST', body: { code: 'rig-rotated-2' } });
  const oldCode = await L.apiAs(null, '/api/pair', { method: 'POST', body: { code: CODE, name: 'x' }, deviceToken: null });
  const kitchen = await L.apiAs('ezra', '/api/profiles');
  log('rotate: status / old code pairs? / paired Kitchen iPad still works?', `${rot.status} / ${oldCode.status} ${oldCode.body.error} / ${kitchen.status}`);
  const gen = await L.apiAs('eli', '/api/admin/pairing-code/rotate', { method: 'POST', body: {} });
  log('rotate (generate): returned code length', String(gen.body.code && gen.body.code.length));

  // ── unpair from the admin panel's route, and what the unpaired device shows ──
  const extra = await L.newDevice({ name: 'Spare iPad', profiles: ['kiara'] });
  const self = await L.apiAs('eli', `/api/admin/devices/${L.S.info.device.id}`, { method: 'DELETE' });
  log('admin unpairs his own device', `${self.status} ${self.body.error}`);
  const un = await L.apiAs('eli', `/api/admin/devices/${extra.device.id}`, { method: 'DELETE' });
  log('unpair Spare iPad', String(un.status));
  const sp = await L.device({ device: 'ipad-portrait', profile: null, deviceToken: extra.device.token, fixedTime: false });
  await sp.goto(''); await sleep(2500);
  log('Spare iPad after unpair shows', await sp.page.evaluate(() => (document.querySelector('#pairform') ? 'pairing screen: ' : 'picker: ') + ((document.getElementById('pairmsg') || document.getElementById('pickmsg') || {}).textContent || '')));
  await shot(sp, 'pairing-unpaired-spare.png');
  // ── the rate limit is per IP address (the whole house shares one) — last, so the lockout does not colour the checks above ──
  const tries = [];
  for (let i = 0; i < 11; i++) tries.push((await L.apiAs(null, '/api/pair', { method: 'POST', body: { code: 'nope-' + i, name: 'x' }, deviceToken: null })).status);
  const right = await L.apiAs(null, '/api/pair', { method: 'POST', body: { code: gen.body.code, name: 'Grandma iPad' }, deviceToken: null });
  log('11 wrong codes, then the right one (same IP)', `${tries.join(',')} → right code: ${right.status} ${right.body.error || ''} ${right.body.message || ''}`);

} finally { await L.close(); }
