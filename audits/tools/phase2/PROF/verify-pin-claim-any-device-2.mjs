// PROF skeptic #2 for finding "pin-claim-any-device": can any paired device, with nobody (or a kid) signed in, create the
// first PIN for a PIN-less adult and so take the profile? Local rig only (typical seed, real clock), fresh instance.
//
//   node "audits/tools/phase2/PROF/verify-pin-claim-any-device-2.mjs"
//
// Evidence: audits/evidence/p2/PROF/verify2-*.png (1x css) and verify2-pin-claim.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };
const R = {};
const log = (k, v) => { R[k] = v; console.log(k.padEnd(58), typeof v === 'string' ? v : JSON.stringify(v)); };
const brief = r => `${r.status} ${r.body && (r.body.error || (r.body.profile ? 'profile=' + r.body.profile.id + ' kind=' + r.body.profile.kind : 'ok'))}`;

const L = await local({ variant: 'typical', clock: 'real' });
try {
  // 0. who has no PIN in the demo seed (production state is unknown to the rig)
  const prof = await L.apiAs(null, '/api/profiles');
  const list = prof.body.profiles || prof.body;
  log('0. adults without a PIN in the seed', list.filter(p => p.kind === 'adult' && !p.is_guest && !p.has_pin).map(p => p.id));

  // 1. UI: Ezra (kid) is signed in on the Kitchen iPad → Me → Switch → tap Mea → 1111, Continue, 1111, Continue
  { const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false }); const { page } = d;
    await d.goto('#me'); await page.waitForSelector('#switch', { timeout: 15000 });
    log('1a. signed in as (before)', await page.evaluate(() => ({ id: hub.profile.id, kind: hub.profile.kind })));
    await page.click('#switch');
    await page.waitForSelector('#profiles .pcard[data-id="niece"]', { timeout: 15000 });
    log('1b. Mea card label on the picker', await page.textContent('#profiles .pcard[data-id="niece"] .psub'));
    await page.click('#profiles .pcard[data-id="niece"]'); await page.waitForSelector('#pad');
    log('1c. pad title / hint', `${await page.textContent('.pin-who h2')} / ${await page.textContent('#pinhint')}`);
    for (const k of '1111') await page.click(`#pad [data-d="${k}"]`); await page.click('#pingo'); await sleep(300);
    for (const k of '1111') await page.click(`#pad [data-d="${k}"]`);
    R.shotPad = await shot(d, 'verify2-kid-creates-mea-pin-ipad.png');
    await page.click('#pingo');
    await page.waitForFunction(() => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === 'niece', null, { timeout: 10000 });
    await sleep(800);
    log('1d. now signed in as', await page.evaluate(() => ({ id: hub.profile.id, kind: hub.profile.kind, canWrite: hub.canWrite, tiles: [...document.querySelectorAll('#grid .tile')].map(t => t.dataset.id), chatTab: !!document.querySelector('.tab[data-tab="chat"]') })));
    R.shotShell = await shot(d, 'verify2-mea-shell-after-kid-claim-ipad.png');
    await d.close(); }

  // 2. the real Mea, later, on her own phone (another paired device): her own PIN is refused; creation is closed
  const meaPhone = await L.newDevice({ name: "Mea's phone (rig)", profiles: [] });
  const asMeaPhone = { deviceToken: meaPhone.device.token, profileToken: null };
  log('2a. Mea (own phone) tries to create her PIN 2468', brief(await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: '2468' }, ...asMeaPhone })));
  const tries = []; for (let i = 0; i < 6; i++) tries.push((await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'niece', pin: '2468' }, ...asMeaPhone })).status);
  log('2b. Mea logs in with 2468 six times (statuses)', tries.join(','));

  // 3. after an admin Reset PIN on David: the TV's device token (session: kiosk only) claims David
  log('3a. Eli resets David', brief(await L.apiAs('eli', '/api/admin/profiles/dad/reset-pin', { method: 'POST', body: {} })));
  const tv = await L.newDevice({ name: 'Downstairs TV (rig)', profiles: ['tv'] });
  const claim = await L.apiAs(null, '/api/profiles/dad/pin', { method: 'POST', body: { pin: '9999' }, deviceToken: tv.device.token, profileToken: null });
  log('3b. TV device, no profile token, POST /api/profiles/dad/pin', brief(claim));
  const tok = claim.body.profile_token;
  const asClaimer = { deviceToken: tv.device.token, profileToken: tok };
  const pd = await L.apiAs(null, '/api/data/f260?scope=person', asClaimer);
  log('3c. claimer reads David person-scope f260', `${pd.status} rows=${(pd.body.items || []).length} keys=${JSON.stringify((pd.body.items || []).map(i => i.key).slice(0, 6))}`);
  const w = await L.apiAs(null, '/api/data/hub/verify2-probe?scope=person', { method: 'PUT', body: { value: 'x', updated_at: Date.now() }, ...asClaimer });
  log('3d. claimer writes David person scope', `${w.status}`);
  log('3e. David (own device) then tries to create his PIN', brief(await L.apiAs(null, '/api/profiles/dad/pin', { method: 'POST', body: { pin: '1234' }, ...asMeaPhone })));

  // 4. a kid session on the calling device is ignored (only the device token is checked): reset Elizabeth, claim with Ezra's token
  await L.apiAs('eli', '/api/admin/profiles/mom/reset-pin', { method: 'POST', body: {} });
  // (a fresh device with a live Ezra session: step 1's Switch signed Ezra out on the rig iPad, which deletes that session)
  const kidDev = await L.newDevice({ name: 'Kids tablet (rig)', profiles: ['ezra'] });
  log('4. device with a live Ezra (kid) session claims Elizabeth', brief(await L.apiAs(null, '/api/profiles/mom/pin', { method: 'POST', body: { pin: '4444' }, deviceToken: kidDev.device.token, profileToken: kidDev.sessions.ezra })));

  // 5. recovery path: admin sees the state, Reset PIN kills the claimer's session
  const adm = await L.apiAs('eli', '/api/profiles');
  const rows = (adm.body.profiles || adm.body || []);
  log('5a. admin list has_pin for niece/dad/mom', Array.isArray(rows) ? rows.filter(r => ['niece', 'dad', 'mom'].includes(r.id)).map(r => `${r.id}:${r.has_pin}`) : `${adm.status}`);
  await L.apiAs('eli', '/api/admin/profiles/dad/reset-pin', { method: 'POST', body: {} });
  log('5b. claimer token after admin re-resets David', brief(await L.apiAs(null, '/api/me', asClaimer)));

  // 6. rate limit on creation: a success needs no guessing; count what 12 valid-looking creates on an already-set profile return
  const c12 = []; for (let i = 0; i < 12; i++) c12.push((await L.apiAs(null, '/api/profiles/eli/pin', { method: 'POST', body: { pin: '12345' } })).status);
  log('6. 12 creates on Eli (PIN set) statuses', [...new Set(c12)].join(','));
  // 7. context: the designed-in PIN-less guest (CLAUDE.md "a PIN-less guest opens on tap and can use every adult app and chat")
  //    is also reachable from the kid's device with no secret at all
  const g = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'guest-grandmajo' }, deviceToken: kidDev.device.token, profileToken: null });
  log('7. kid device taps PIN-less guest Grandma Jo', `${g.status} ${g.body.error || ('kind=' + g.body.profile.kind + ' guest=' + !!g.body.profile.is_guest)}`);
  fs.writeFileSync(path.join(OUT, 'verify2-pin-claim.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
