// Skeptic #1 for SEC finding "create-pin-claims-pinless-adult". Independent of rate-limits.mjs: runs the rig's real
// server (lib/local.mjs, real worker/src on in-memory SQLite, demo household where Mea/niece has pin:false).
// Run:  node "audits/tools/phase2/SEC/verify-create-pin-claims-pinless-adult-1.mjs"
//  A. API path: a device paired through the real /api/pair (throwaway code) with NO profile session POSTs
//     /api/profiles/niece/pin once → session as Mea? Real Mea then locked out? 12 more calls → any 429?
//     Is anything logged (activity feed) so the household would notice?
//  B. UI path (after a reset): Ezra (kid) on the Kitchen iPad → Me → Switch → picker shows Mea "Create your PIN" →
//     tap, type 7777 twice → the shell is signed in as Mea. i.e. the "attack" is the designed first-tap flow.
//  C. What a kid tap-session can already do without claiming Mea (family-scope write) vs the adult-only extras.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p2/SEC');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const niece0 = (await L.apiAs('eli', '/api/profiles')).body.profiles.find(p => p.id === 'niece');
  out.seed_niece = { name: niece0.name, kind: niece0.kind, has_pin: niece0.has_pin, is_guest: !!niece0.is_guest };

  // ── A. API path from a freshly paired device (real /api/pair) ──
  await L.setPairingCode('throwaway-skeptic-code');
  const pair = await fetch(L.api + '/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: L.site }, body: JSON.stringify({ code: 'throwaway-skeptic-code', name: 'Visitor phone' }) });
  const pj = await pair.json();
  const dt = pj.device_token;
  out.pair = { status: pair.status, got_device_token: !!dt };
  const claim = await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: '7777' }, deviceToken: dt, profileToken: null });
  out.claim = { status: claim.status, got_profile_token: !!(claim.body && claim.body.profile_token), profile: claim.body && claim.body.profile && { id: claim.body.profile.id, name: claim.body.profile.name, kind: claim.body.profile.kind, has_pin: claim.body.profile.has_pin } };
  const me = await L.apiAs(null, '/api/me', { deviceToken: dt, profileToken: claim.body.profile_token });
  out.me_with_claimed_token = { status: me.status, id: me.body.profile && me.body.profile.id, kind: me.body.profile && me.body.profile.kind };
  // the real Mea on the Kitchen iPad now: she does not know 7777
  const meaCreate = await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: '2468' }, profileToken: null });
  const meaLogin = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'niece', pin: '2468' }, profileToken: null });
  out.real_mea_after = { create_pin: { status: meaCreate.status, error: meaCreate.body.error }, login_with_her_own_pin: { status: meaLogin.status, error: meaLogin.body.error } };
  // rate limiting: repeated create-PIN calls
  const statuses = [];
  for (let i = 0; i < 12; i++) statuses.push((await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: String(1000 + i) }, deviceToken: dt, profileToken: null })).status);
  out.repeat_12 = { statuses: [...new Set(statuses)], any_429: statuses.includes(429), note: 'after the one-shot claim every call is 409 — there is no secret to guess, so a throttle has nothing to limit' };
  // does the claim leave any trace the household would see?
  const feed = await L.apiAs('eli', '/api/activity?limit=100');
  out.activity_mentions_mea_pin = (feed.body.items || feed.body.activity || feed.body || []).filter?.(a => a.profile_id === 'niece' && /pin/i.test(a.text || '')).length ?? 'n/a';
  const adminView = (await L.apiAs('eli', '/api/profiles')).body.profiles.find(p => p.id === 'niece');
  out.admin_sees_has_pin = adminView.has_pin;

  // ── C. what the claimed adult session adds over a kid tap session (same device, no PIN needed for Ezra) ──
  const ezraLogin = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'ezra' }, deviceToken: dt, profileToken: null });
  const ezraT = ezraLogin.body.profile_token;
  const famWriteKid = await L.apiAs(null, '/api/data/leftovers/item:skeptic?scope=family', { method: 'PUT', body: { value: { name: 'probe' }, updated_at: Date.now() }, deviceToken: dt, profileToken: ezraT });
  const guestKid = await L.apiAs(null, '/api/profiles', { method: 'POST', body: { name: 'Probe', emoji: '🙂', color: '#5B6FA8', expires: 'tonight' }, deviceToken: dt, profileToken: ezraT });
  const guestMea = await L.apiAs(null, '/api/profiles', { method: 'POST', body: { name: 'Probe', emoji: '🙂', color: '#5B6FA8', expires: 'tonight' }, deviceToken: dt, profileToken: claim.body.profile_token });
  out.capability_delta = {
    kid_tap_login: ezraLogin.status,
    kid_family_write: famWriteKid.status,
    kid_add_guest: { status: guestKid.status, error: guestKid.body.error },
    claimed_mea_add_guest: { status: guestMea.status, error: guestMea.body.error },
  };

  // ── B. the same thing through the designed UI, as Ezra on the Kitchen iPad ──
  await L.reset('typical');
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
  await ipad.goto('#me');
  await ipad.page.waitForSelector('#switch', { timeout: 15000 });
  await ipad.page.click('#switch');
  await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 15000 });
  await sleep(600);
  out.ui_picker_niece_label = (await ipad.page.textContent('.pcard[data-id="niece"] .psub')).trim();
  await ipad.page.screenshot({ path: path.join(OUT, 'verify-create-pin-picker-1.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  await ipad.page.click('.pcard[data-id="niece"]');
  await ipad.page.waitForSelector('#pad', { timeout: 10000 });
  out.ui_pad_title = (await ipad.page.textContent('.pin-who h2')).trim();
  for (const round of [0, 1]) { for (const d of '7777') await ipad.page.click(`#pad button[data-d="${d}"]`); await ipad.page.click('#pingo'); await sleep(400); }
  await ipad.page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'niece', null, { timeout: 10000 }).catch(() => {});
  out.ui_signed_in_as = await ipad.page.evaluate(() => window.hub && hub.profile && { id: hub.profile.id, name: hub.profile.name, kind: hub.profile.kind });
  await sleep(500);
  await ipad.page.screenshot({ path: path.join(OUT, 'verify-create-pin-ui-as-mea-1.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  const niece2 = (await L.apiAs('eli', '/api/profiles')).body.profiles.find(p => p.id === 'niece');
  out.ui_after_has_pin = niece2.has_pin;
  out.console_errors = ipad.logs.filter(l => /error/i.test(l)).slice(0, 5);
} catch (e) {
  out.error = String(e && e.stack || e);
} finally {
  await L.close();
}
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'verify-create-pin-claims-pinless-adult-1.json'), JSON.stringify(out, null, 1));
