// PROF skeptic #1 for finding "admin-self-reset-claimable": the admin resets his OWN PIN from the admin panel; is the
// admin profile then claimable (first PIN created) by another paired device, with admin rights? Local rig only
// (typical seed, real clock), fresh instance, nothing touches production.
//
//   node "audits/tools/phase2/PROF/verify-admin-self-reset-claimable-1.mjs"
//
// Evidence: audits/evidence/p2/PROF/verify-admin-self-reset-*.png (1x css) and verify-admin-self-reset-1.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };
const R = {};
const log = (k, v) => { R[k] = v; console.log(k.padEnd(60), typeof v === 'string' ? v : JSON.stringify(v)); };
const brief = r => `${r.status} ${r.body && (r.body.error || (r.body.profile ? 'profile=' + r.body.profile.id + ' is_admin=' + r.body.profile.is_admin : 'ok'))}`;
const profilesNow = async () => { const r = await L.apiAs(null, '/api/profiles'); return r.body.profiles || r.body; };

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const before = await profilesNow();
  log('0. admins in the seed / eli has_pin', { admins: before.filter(p => p.is_admin).map(p => p.id), eliHasPin: before.find(p => p.id === 'eli').has_pin });
  const eliOldToken = L.S.info.sessions.eli;

  // 1. Kitchen iPad, Eli signed in → Me → admin panel → his own row
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false }); const { page } = ipad;
  const dialogs = []; page.on('dialog', dl => { dialogs.push(dl.message()); dl.accept(); });
  await ipad.goto('#me'); await page.waitForSelector('#admin-body .admin-people', { timeout: 15000 });
  log('1a. signed in as', await page.evaluate(() => ({ id: hub.profile.id, isAdmin: hub.profile.isAdmin, device: hub.device && hub.device.id })));
  log('1b. own row buttons (Eli)', await page.evaluate(() => { const b = document.querySelector('#admin-body [data-edit="eli"]'); const li = b && b.closest('li'); return li ? [...li.querySelectorAll('button')].map(x => x.textContent + (x.dataset.resetpin ? '[data-resetpin=' + x.dataset.resetpin + ']' : '')) : null; }));
  log('1c. contrast: Unpair offered on this device row?', await page.evaluate(() => [...document.querySelectorAll('#admin-body .row')].filter(li => /this device/.test(li.textContent)).map(li => ({ text: li.querySelector('.row-sub').textContent, unpair: !!li.querySelector('[data-unpair]') }))));

  // 2. tap Reset PIN on his own row, accept the confirm()
  await page.click('#admin-body [data-resetpin="eli"]');
  await page.waitForFunction(() => !document.getElementById('gate').hidden, null, { timeout: 10000 }).catch(() => {});
  await sleep(1500);
  log('2a. confirm() text', dialogs.at(-1) || null);
  log('2b. iPad after the reset', await page.evaluate(() => ({ gateShown: !document.getElementById('gate').hidden, session: !!hub.session, pickmsg: (document.getElementById('pickmsg') || {}).textContent || null, eliCard: (document.querySelector('#profiles .pcard[data-id="eli"] .psub') || {}).textContent || null })));
  R.shotIpadPicker = await shot(ipad, 'verify-admin-self-reset-1-ipad-picker.png');
  const after = await profilesNow();
  log('2c. server: eli has_pin after reset', after.find(p => p.id === 'eli').has_pin);
  log('2d. server: Eli old session token → /api/me', brief(await L.apiAs(null, '/api/me', { profileToken: eliOldToken })));

  // 2e. on the iPad, what does tapping his own card lead to? (then Back — do not create)
  await page.click('#profiles .pcard[data-id="eli"]'); await page.waitForSelector('#pad', { timeout: 10000 });
  log('2e. iPad: tapping Eli → pad title / hint', `${await page.textContent('.pin-who h2')} / ${await page.textContent('#pinhint')}`);
  await page.click('#pad [data-a="back"]'); await sleep(500);

  // 3. ANOTHER paired device (a phone paired for the kids; Ezra signed in) → Me → Switch → tap Eli → create a PIN
  const kidDev = await L.newDevice({ name: 'Kids phone (rig)', profiles: ['ezra'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: kidDev }); const pp = phone.page;
  await phone.goto('#me'); await pp.waitForSelector('#switch', { timeout: 15000 });
  log('3a. phone signed in as', await pp.evaluate(() => ({ id: hub.profile.id, kind: hub.profile.kind, device: hub.device && hub.device.id })));
  await pp.click('#switch'); await pp.waitForSelector('#profiles .pcard[data-id="eli"]', { timeout: 15000 });
  log('3b. phone picker: Eli card label', await pp.textContent('#profiles .pcard[data-id="eli"] .psub'));
  await pp.click('#profiles .pcard[data-id="eli"]'); await pp.waitForSelector('#pad', { timeout: 10000 });
  log('3c. phone: pad title / hint', `${await pp.textContent('.pin-who h2')} / ${await pp.textContent('#pinhint')}`);
  for (const k of '2580') await pp.click(`#pad [data-d="${k}"]`); await pp.click('#pingo'); await sleep(300);
  for (const k of '2580') await pp.click(`#pad [data-d="${k}"]`); await pp.click('#pingo');
  await pp.waitForFunction(() => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === 'eli', null, { timeout: 10000 });
  await phone.goto('#me'); await pp.waitForSelector('#admin-body .admin-people', { timeout: 15000 }).catch(() => {});
  log('3d. phone now signed in as', await pp.evaluate(() => ({ id: hub.profile.id, isAdmin: hub.profile.isAdmin, adminPanel: !!document.querySelector('#admin-body .admin-people'), rotate: !!document.getElementById('rotate-choose') })));
  R.shotPhoneAdmin = await shot(phone, 'verify-admin-self-reset-1-phone-admin.png');
  const tok = await pp.evaluate(() => hub.session && hub.session.token);
  const asClaimer = { deviceToken: kidDev.device.token, profileToken: tok };
  log('3e. claimer token GET /api/admin/usage', (await L.apiAs(null, '/api/admin/usage', asClaimer)).status);

  // 4. the real Eli back at the iPad: his card now asks for a PIN he never chose
  await page.evaluate(() => location.reload()); await page.waitForSelector('#profiles .pcard[data-id="eli"]', { timeout: 15000 });
  log('4a. iPad picker: Eli card label now', await page.textContent('#profiles .pcard[data-id="eli"] .psub'));
  await page.click('#profiles .pcard[data-id="eli"]'); await page.waitForSelector('#pad', { timeout: 10000 });
  log('4b. iPad: tapping Eli → pad title / hint', `${await page.textContent('.pin-who h2')} / ${await page.textContent('#pinhint')}`);
  const eliCreate = await L.apiAs(null, '/api/profiles/eli/pin', { method: 'POST', body: { pin: '1357' }, profileToken: null });
  log('4c. real Eli tries to create his own PIN 1357 (iPad token)', brief(eliCreate));
  const other = (await profilesNow()).filter(p => p.is_admin).map(p => p.id);
  log('4d. admins now (anyone else to reset Eli?)', other);
  log('4e. another adult (Mae) tries reset-pin on eli', brief(await L.apiAs('christian', '/api/admin/profiles/eli/reset-pin', { method: 'POST', body: {} })));

  log('dialogs seen', dialogs);
  log('ipad logs (errors)', ipad.logs.filter(l => /error/i.test(l)).slice(0, 5));
  fs.writeFileSync(path.join(OUT, 'verify-admin-self-reset-1.json'), JSON.stringify({ at: new Date().toISOString(), ...R }, null, 1));
} finally { await L.close(); }
