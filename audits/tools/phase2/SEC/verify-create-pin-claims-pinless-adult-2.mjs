// SEC skeptic #2: "Any paired device can claim a PIN-less household adult (Mea) in one unthrottled call".
// Re-runs the claim on a fresh local instance (real Worker, demo household 'typical', real clock) and measures what the
// claim adds over what any paired device can ALREADY do by design (device-only family reads, kid-on-tap, PIN-less guest).
// Part B drives the ordinary shell UI on the shared Kitchen iPad (signed out): tap Mea → "Create your PIN" → 7777 twice.
// Run:  node "audits/tools/phase2/SEC/verify-create-pin-claims-pinless-adult-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const s = r => ({ status: r.status, error: r.body && r.body.error });

const L = await local({ variant: 'typical', clock: 'real' });
try {
  // ── A. API: a device freshly paired through the real /api/pair with a throwaway code ──
  const CODE = 'throwaway-skeptic2-' + Date.now();
  await L.setPairingCode(CODE);
  const pairR = await L.apiAs(null, '/api/pair', { method: 'POST', deviceToken: null, profileToken: null, body: { code: CODE, name: 'attacker phone' } });
  const dt = pairR.body.device_token;
  out.pair = { status: pairR.status, got_device_token: !!dt };
  const A = (p, o = {}) => L.apiAs(null, p, { deviceToken: dt, profileToken: null, ...o });

  const profs = (await A('/api/profiles')).body.profiles;
  out.profiles_has_pin = Object.fromEntries(profs.filter(p => p.kind === 'adult').map(p => [p.id, { name: p.name, has_pin: !!p.has_pin, guest: !!p.is_guest }]));

  // baseline 1: device token only, no profile at all → family-scope read
  const famRead = await A('/api/data/prayer?scope=family');
  out.baseline_device_only_family_read = { ...s(famRead), items: Array.isArray(famRead.body.items) ? famRead.body.items.length : null };
  // baseline 2: kid on tap (no PIN) → family-scope write
  const kid = await A('/api/login', { method: 'POST', body: { profile_id: 'ezra' } });
  const kt = kid.body.profile_token;
  out.baseline_kid_on_tap = { ...s(kid), got_session: !!kt };
  out.baseline_kid_family_write = s(await A('/api/data/leftovers/item:skeptic2-kid?scope=family', { method: 'PUT', profileToken: kt, body: { value: { name: 'kid wrote this', added: Date.now() }, updated_at: Date.now() } }));
  out.baseline_kid_add_guest = s(await A('/api/profiles', { method: 'POST', profileToken: kt, body: { name: 'KidGuest' } }));
  out.baseline_kid_rally = s(await A('/api/dollywood/rally', { method: 'POST', profileToken: kt, body: { name: 'Kid rally', x: 1, y: 1 } }));
  // baseline 3: PIN-less guest on tap (Grandma Jo, by design "can use every adult app and chat")
  const jo = await A('/api/login', { method: 'POST', body: { profile_id: 'guest-grandmajo' } });
  const jt = jo.body.profile_token;
  out.baseline_pinless_guest_on_tap = { ...s(jo), got_session: !!jt, kind: jo.body.profile && jo.body.profile.kind };
  out.baseline_guest_add_guest = s(await A('/api/profiles', { method: 'POST', profileToken: jt, body: { name: 'GuestGuest' } }));
  out.baseline_guest_rally = s(await A('/api/dollywood/rally', { method: 'POST', profileToken: jt, body: { name: 'Guest rally', x: 1, y: 1 } }));

  const actBefore = (await L.apiAs('eli', '/api/activity?limit=100')).body.activity.length;

  // the claim
  const claim = await A('/api/profiles/niece/pin', { method: 'POST', body: { pin: '7777' } });
  const mt = claim.body.profile_token;
  out.claim = { ...s(claim), got_session: !!mt, name: claim.body.profile && claim.body.profile.name, kind: claim.body.profile && claim.body.profile.kind };
  out.claim_repeat = [];
  for (let i = 0; i < 5; i++) out.claim_repeat.push(s(await A('/api/profiles/niece/pin', { method: 'POST', body: { pin: String(1000 + i) } })));
  out.claim_on_pinned_adult = s(await A('/api/profiles/christian/pin', { method: 'POST', body: { pin: '1111' } }));
  out.claim_on_guest = s(await A('/api/profiles/guest-grandmajo/pin', { method: 'POST', body: { pin: '1111' } }));

  // what the claimed session adds over the kid / PIN-less guest baselines
  out.mea_me = (await A('/api/me', { profileToken: mt })).body.profile?.name;
  out.mea_add_guest = s(await A('/api/profiles', { method: 'POST', profileToken: mt, body: { name: 'Claimed guest' } }));
  out.mea_rally = s(await A('/api/dollywood/rally', { method: 'POST', profileToken: mt, body: { name: 'Claimed rally', x: 1, y: 1 } }));
  // Mea never signed in: what person-scope data of hers does the claimer see?
  const personApps = ['f260', 'verses', 'hub', 'timer', 'prayer', 'tally'];
  out.mea_person_rows_visible = {};
  for (const a of personApps) { const r = await A(`/api/data/${a}?scope=person`, { profileToken: mt }); out.mea_person_rows_visible[a] = Array.isArray(r.body.items) ? r.body.items.length : r.status; }

  // the real Mea, on the Kitchen iPad, tries her own intended first PIN
  out.real_mea_login_after_claim = s(await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'niece', pin: '2468' } }));
  out.real_mea_create_after_claim = s(await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: '2468' } }));
  const actAfter = (await L.apiAs('eli', '/api/activity?limit=100')).body.activity;
  out.activity_total_before_after = [actBefore, actAfter.length];
  out.activity_lines_by_mea = actAfter.filter(a => a.profile_id === 'niece').map(a => a.text);   // the claim itself writes none
  out.activity_mentions_pin = actAfter.filter(a => /pin/i.test(a.text || '')).map(a => a.text);
  out.admin_sees_has_pin = !!(await L.apiAs('eli', '/api/profiles')).body.profiles.find(p => p.id === 'niece').has_pin;

  // recovery: the admin resets Mea's PIN → claimer's session dies, the real Mea creates hers
  out.admin_reset = s(await L.apiAs('eli', '/api/admin/profiles/niece/reset-pin', { method: 'POST' }));
  out.claimer_session_after_reset = s(await A('/api/me', { profileToken: mt }));
  out.real_mea_create_after_reset = s(await L.apiAs(null, '/api/profiles/niece/pin', { method: 'POST', body: { pin: '2468' } }));

  // ── B. UI: the same claim with ten taps on the shared Kitchen iPad, signed out ──
  await L.reset('typical');
  const ipad = await L.device({ device: 'ipad-portrait', profile: null, fixedTime: false });
  await ipad.goto('');
  await ipad.page.waitForSelector('.pcard[data-id="niece"]', { timeout: 15000 });
  out.ui_mea_tile_subtitle = await ipad.page.$eval('.pcard[data-id="niece"] .psub', e => e.textContent.trim());
  await ipad.page.click('.pcard[data-id="niece"]');
  await ipad.page.waitForSelector('#pad', { timeout: 10000 });
  out.ui_pad_title = await ipad.page.$eval('.pin-who h2', e => e.textContent.trim());
  await ipad.page.screenshot({ path: path.join(OUT, 'verify-create-pin-2-ui-pad.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  for (const round of [0, 1]) { await ipad.page.keyboard.type('7777'); await ipad.page.keyboard.press('Enter'); await sleep(400); }
  let who = null; const until = Date.now() + 10000;
  while (Date.now() < until) { who = await ipad.page.evaluate(() => window.hub && hub.profile && hub.profile.name).catch(() => null); if (who) break; await sleep(200); }
  out.ui_signed_in_as = who;
  await sleep(800);
  await ipad.page.screenshot({ path: path.join(OUT, 'verify-create-pin-2-ui-after.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
} finally {
  await L.close();
}
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'verify-create-pin-claims-pinless-adult-2.json'), JSON.stringify(out, null, 1));
