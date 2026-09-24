// PROF (audit Phase 2), skeptic #2 for "admin-self-reset-claimable": can the admin reset his own PIN from the admin panel,
// does that drop his sessions, and can another paired device then create Eli's PIN and hold admin rights?
// Also checks the context: is there any other way for an adult (or the admin) to change their own PIN, what the iPad
// offers Eli right after the reset (Create PIN or the pad?), whether the same window opens for any adult reset, and
// what recovery exists once someone else has claimed the admin. Local rig only.
//
//   node "audits/tools/phase2/PROF/verify-admin-self-reset-claimable-2.mjs"
//
// Evidence: audits/evidence/p2/PROF/verify2-admin-self-reset-*.png + verify2-admin-self-reset.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const R = {};
const log = (k, v) => { R[k] = v; console.log(k.padEnd(60), typeof v === 'string' ? v : JSON.stringify(v)); };
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  // a second paired device with nobody signed in (e.g. a family member's phone at the picker)
  const spare = await L.newDevice({ name: 'Spare phone', profiles: [] });
  const asSpare = (p, opt = {}) => L.apiAs(null, p, { ...opt, deviceToken: spare.device.token, profileToken: opt.profileToken ?? null });

  const before = await L.apiAs('eli', '/api/admin/usage');
  log('0. Eli admin token before: GET /api/admin/usage', before.status);
  const profs = await L.apiAs('eli', '/api/profiles');
  log('0b. seed: admins / adults with has_pin', (profs.body.profiles || []).filter(p => p.kind === 'adult' && !p.is_guest).map(p => `${p.id}:admin=${!!p.is_admin}:pin=${!!p.has_pin}`));

  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false }); const { page } = d;
  const dialogs = []; page.on('dialog', dl => { dialogs.push(dl.type() + ': ' + dl.message()); dl.accept(); });
  await d.goto('#me'); await page.waitForSelector('#admin-body .admin-people', { timeout: 15000 });

  // context: any self-service "change my PIN" anywhere in Me?
  log('1a. Me tab controls mentioning PIN (outside admin rows)', await page.evaluate(() => [...document.querySelectorAll('button, a, [role=button]')].filter(b => !b.closest('#admin-body .admin-people') && /pin/i.test(b.textContent)).map(b => b.textContent.trim())));
  log('1b. admin rows → buttons', await page.evaluate(() => [...document.querySelectorAll('#admin-body .admin-people li')].map(li => li.querySelector('.row-title').textContent + ' → ' + [...li.querySelectorAll('button')].map(b => b.textContent).join('/'))));
  log('1c. own row has Reset PIN', await page.$('#admin-body [data-resetpin="eli"]') !== null);

  // Eli taps Reset PIN on his own row and OKs the confirm()
  await page.click('#admin-body [data-resetpin="eli"]'); await sleep(2500);
  log('2a. dialogs', dialogs);
  log('2b. iPad after own reset', await page.evaluate(() => ({ gate: !document.getElementById('gate').hidden, session: !!(window.hub && hub.session), eliCard: (document.querySelector('#profiles .pcard[data-id="eli"] .psub') || {}).textContent || null, pickmsg: (document.getElementById('pickmsg') || {}).textContent || null })));
  R.shotPicker = await shot(d, 'verify2-admin-self-reset-picker-ipad.png');
  const old = await L.apiAs('eli', '/api/admin/usage');
  log('2c. Eli old admin token after reset: GET /api/admin/usage', `${old.status} ${old.body.error || ''}`);

  // what Eli gets if he taps his own card now (before anyone else acts)
  await page.click('#profiles .pcard[data-id="eli"]'); await sleep(900);
  log('2d. Eli taps his card → pad title / hint', await page.evaluate(() => ({ title: (document.querySelector('.pin-who h2') || {}).textContent || null, hint: (document.getElementById('pinhint') || {}).textContent || null })));
  R.shotCreate = await shot(d, 'verify2-admin-self-reset-create-ipad.png');

  // …but meanwhile the spare device (no profile signed in) creates Eli's PIN
  const claim = await asSpare('/api/profiles/eli/pin', { method: 'POST', body: { pin: '5555' } });
  log('3a. spare device (no profile token) POST /api/profiles/eli/pin', `${claim.status} ${claim.body.profile ? 'id=' + claim.body.profile.id + ' is_admin=' + claim.body.profile.is_admin : claim.body.error}`);
  const tok = claim.body.profile_token;
  const u = await asSpare('/api/admin/usage', { profileToken: tok });
  log('3b. claimer token: GET /api/admin/usage', `${u.status} devices=${u.body.devices ? u.body.devices.length : '-'}`);
  const rot = await asSpare('/api/admin/pairing-code/rotate', { method: 'POST', body: {}, profileToken: tok });
  log('3c. claimer token: POST /api/admin/pairing-code/rotate', `${rot.status} ${rot.body.code ? 'new code returned' : rot.body.error || ''}`);

  // Eli, on the iPad, finishes creating his PIN 1234
  for (const n of '1234') await page.click(`#pad [data-d="${n}"]`);
  await page.click('#pingo'); await sleep(700);
  for (const n of '1234') await page.click(`#pad [data-d="${n}"]`);
  await page.click('#pingo'); await sleep(1500);
  log('4a. Eli finishes Create PIN on the iPad → screen / signed in', await page.evaluate(() => ({ title: (document.querySelector('.pin-who h2') || {}).textContent || null, hint: (document.getElementById('pinhint') || {}).textContent || null, msg: (document.getElementById('pinmsg') || {}).textContent || null, gate: !document.getElementById('gate').hidden, session: !!(window.hub && hub.session), who: window.hub && hub.profile && hub.profile.id })));
  R.shotAfter = await shot(d, 'verify2-admin-self-reset-eli-locked-ipad.png');
  const eliLogin = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'eli', pin: '1234' }, profileToken: null });
  log('4b. Eli logs in with his old/new PIN 1234', `${eliLogin.status} ${eliLogin.body.error || ''}`);
  const others = (profs.body.profiles || []).filter(p => p.is_admin && p.id !== 'eli').map(p => p.id);
  log('4c. other admins who could reset Eli', others);

  // context: the same window after resetting another adult (Mae) — the claim is the general first-tap design
  const eli2 = (await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'eli', pin: '5555' }, profileToken: null })).body.profile_token;
  const rm = await L.apiAs(null, '/api/admin/profiles/christian/reset-pin', { method: 'POST', body: {}, profileToken: eli2 });
  const cm = await asSpare('/api/profiles/christian/pin', { method: 'POST', body: { pin: '7777' } });
  log('5. admin resets Mae → spare device creates Mae PIN', `${rm.status} → ${cm.status} ${cm.body.profile ? 'id=' + cm.body.profile.id : cm.body.error}`);

  // same flow via the server alone: does the API refuse an admin resetting himself?
  const self = await L.apiAs(null, '/api/admin/profiles/eli/reset-pin', { method: 'POST', body: {}, profileToken: eli2 });
  log('6. API: admin POST /api/admin/profiles/eli/reset-pin on himself', `${self.status} ${self.body.error || 'ok'}`);

  fs.writeFileSync(path.join(OUT, 'verify2-admin-self-reset.json'), JSON.stringify(R, null, 1));
  await d.close();
} finally { await L.close(); }
