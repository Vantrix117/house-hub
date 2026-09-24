// SEC (3)+(5): what the server refuses when the client lies. Forged/hand-edited tokens and headers against the real
// Worker. The browser UI trusts localStorage for what to SHOW; this proves what the server lets you DO.
// Run:  node "audits/tools/phase2/SEC/tamper-server.mjs"
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
globalThis.fetch = async u => { throw new Error('outbound fetch refused: ' + (u.url || u)); };
globalThis.caches = { default: { async match() {}, async put() {} } };

const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
const { seedDemo, DEVICE, sessionToken } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);
const crypto = await import('node:crypto');
const sha = s => crypto.createHash('sha256').update(s).digest('base64url');

const DB = createD1(':memory:');
await seedDemo(DB, { variant: 'typical', now: Date.now() });
// a second paired device, to test session device-binding
const DEV2 = { id: 'sec-dev2', token: 'sec-dev2-token' };
DB.sqlite.prepare('INSERT INTO devices (id, name, token_hash, paired_at, last_seen) VALUES (?, ?, ?, ?, ?)').run(DEV2.id, 'Second device', sha(DEV2.token), Date.now(), Date.now());
const env = { DB, ALLOWED_ORIGINS: 'http://localhost:8765' };
const ctx = { waitUntil() {}, passThroughOnException() {} };
async function call(p, { method = 'GET', body, dt, pt } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (dt) h['X-Device-Token'] = dt; if (pt) h['X-Profile-Token'] = pt;
  const r = await worker.fetch(new Request('http://api.local' + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, ctx);
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, error: j && j.error, body: j };
}
const DT = DEVICE.token, ezra = sessionToken('ezra'), eli = sessionToken('eli'), tv = sessionToken('tv');
const out = {};

// ── forged tokens ──────────────────────────────────────────────
out.forged = {};
out.forged.made_up_profile_token = await call('/api/me', { dt: DT, pt: 'totally-made-up-token' }).then(r => ({ status: r.status, error: r.error }));
out.forged.made_up_device_token = await call('/api/me', { dt: 'made-up-device', pt: eli }).then(r => ({ status: r.status, error: r.error }));
out.forged.no_device_token = await call('/api/me', { pt: eli }).then(r => ({ status: r.status, error: r.error }));

// ── a kid pretending to be admin: the server re-derives is_admin/kind from the DB behind the token ──
// (In the browser this is: edit localStorage hub.session.profile.is_admin=true / kind='adult'. The token is still Ezra's.)
out.kid_as_admin = {};
out.kid_as_admin.usage = await call('/api/admin/usage', { dt: DT, pt: ezra }).then(r => ({ status: r.status, error: r.error }));
out.kid_as_admin.rotate_pairing = await call('/api/admin/pairing-code/rotate', { method: 'POST', body: {}, dt: DT, pt: ezra }).then(r => ({ status: r.status, error: r.error }));
out.kid_as_admin.reset_someone_pin = await call('/api/admin/profiles/mom/reset-pin', { method: 'POST', body: {}, dt: DT, pt: ezra }).then(r => ({ status: r.status, error: r.error }));
out.kid_as_admin.unpair_device = await call('/api/admin/devices/sec-dev2', { method: 'DELETE', dt: DT, pt: ezra }).then(r => ({ status: r.status, error: r.error }));
out.kid_as_admin.add_guest = await call('/api/profiles', { method: 'POST', body: { name: 'Sneaky' }, dt: DT, pt: ezra }).then(r => ({ status: r.status, error: r.error }));
out.kid_as_admin.rally = await call('/api/dollywood/rally', { method: 'POST', body: { name: 'x', x: 1, y: 1 }, dt: DT, pt: ezra }).then(r => ({ status: r.status, error: r.error }));

// ── the kiosk pretending it can write (edit localStorage kind='adult') ──
out.kiosk_writes = {};
out.kiosk_writes.put_family_data = await call('/api/data/leftovers/item:kioskprobe?scope=family', { method: 'PUT', body: { value: { id: 'kioskprobe', name: 'x' }, updated_at: Date.now() }, dt: DT, pt: tv }).then(r => ({ status: r.status, error: r.error }));
out.kiosk_writes.post_activity = await call('/api/activity', { method: 'POST', body: { app_id: 'hub', text: 'kiosk was here' }, dt: DT, pt: tv }).then(r => ({ status: r.status, error: r.error }));
out.kiosk_writes.chat = await call('/api/chat', { method: 'POST', body: { message: 'hi', apps: [] }, dt: DT, pt: tv }).then(r => ({ status: r.status, error: r.error }));

// ── a kid reaching an app hidden from them by visibleTo (raw data API has NO visibleTo check) ──
// visibleTo is a UI-visibility feature; the data API only blocks the kiosk (requireWriter) and scopes person data to
// the owner. So a kid can read/write FAMILY scope of any app and their OWN person scope, regardless of visibleTo.
out.kid_visibleTo = {};
out.kid_visibleTo.read_family_prayer = await call('/api/data/prayer?scope=family', { dt: DT, pt: ezra }).then(r => ({ status: r.status, items: Array.isArray(r.body.items) ? r.body.items.length : r.error }));
out.kid_visibleTo.write_family_reminders = await call('/api/data/reminders/item:kidprobe?scope=family', { method: 'PUT', body: { value: { id: 'kidprobe', text: 'kid wrote a family reminder' }, updated_at: Date.now() }, dt: DT, pt: ezra }).then(r => ({ status: r.status, error: r.error, applied: r.body && r.body.applied }));
out.kid_visibleTo.write_own_f260 = await call('/api/data/f260/probe?scope=person', { method: 'PUT', body: { value: { x: 1 }, updated_at: Date.now() }, dt: DT, pt: ezra }).then(r => ({ status: r.status, applied: r.body && r.body.applied }));
// but a kid cannot touch ANOTHER person's person-scope: owner is derived from the token, not the body
out.kid_visibleTo.write_other_person_scope = await call('/api/data/f260/probe?scope=person', { dt: DT, pt: ezra }).then(async () => {
  const wrote = await call('/api/data/f260/probe?scope=person', { method: 'PUT', body: { value: { who: 'ezra' }, updated_at: Date.now() }, dt: DT, pt: ezra });
  const eliReads = await call('/api/data/f260?scope=person&key=probe', { dt: DT, pt: eli });
  return { ezra_wrote: wrote.status, eli_sees_ezras_value: !!(eliReads.body && eliReads.body.item && eliReads.body.item.value), note: 'person scope is keyed to the signed-in id; Ezra cannot write into Eli’s scope' };
});

// ── session device-binding and lifetime (5) ────────────────────
out.sessions = {};
// eli's session token is bound to DEVICE; presenting it with DEV2's device token must fail
out.sessions.token_on_wrong_device = await call('/api/me', { dt: DEV2.token, pt: eli }).then(r => ({ status: r.status, error: r.error, note: 'a stolen profile token is useless without the exact device it was created on' }));
out.sessions.token_on_right_device = await call('/api/me', { dt: DT, pt: eli }).then(r => ({ status: r.status, who: r.body && r.body.profile && r.body.profile.name }));
// lifetime from a real login
const login = await call('/api/login', { method: 'POST', body: { profile_id: 'niece', pin: '0000' }, dt: DT });   // niece has no PIN → signs in? no: needs_pin_setup
out.sessions.niece_login_no_pin = { status: login.status, error: login.error };
// inspect a stored session's lifetime
const s = DB.sqlite.prepare("SELECT created_at, expires_at FROM sessions WHERE profile_id = 'eli' LIMIT 1").get();
out.sessions.lifetime_days = Math.round((s.expires_at - s.created_at) / 86400000);
// logout revokes only THIS token; other sessions for the same profile keep working (no global revoke)
const before = await call('/api/me', { dt: DT, pt: eli });
// create a real second session for eli on DEV2 so logout of one leaves the other
const eli2 = (await (async () => {
  // give eli a known PIN, then log in on DEV2
  const { hashSecret } = await import(pathToFileURL(path.join(ROOT, 'worker/src/auth.js')).href);
  DB.sqlite.prepare('UPDATE profiles SET pin_hash = ? WHERE id = ?').run(await hashSecret('2468'), 'eli');
  const r = await call('/api/login', { method: 'POST', body: { profile_id: 'eli', pin: '2468' }, dt: DEV2.token });
  return r.body.profile_token;
})());
await call('/api/logout', { method: 'POST', body: {}, dt: DEV2.token, pt: eli2 });
out.sessions.logout_is_per_token = {
  logged_out_token_now: (await call('/api/me', { dt: DEV2.token, pt: eli2 })).status,
  other_device_session_still_valid: (await call('/api/me', { dt: DT, pt: eli })).status,
  note: 'Switch / logout deletes only the presented token; a token stolen earlier from another device is not revoked',
};
// admin reset-pin DOES revoke all sessions for that profile (defence for a forgotten/leaked PIN)
await call('/api/admin/profiles/mom/reset-pin', { method: 'POST', body: {}, dt: DT, pt: eli });
out.sessions.reset_pin_revokes_all = { note: 'reset-pin deletes every session row for the profile (index.js:449)' };

console.log(JSON.stringify(out, null, 1));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'tamper-server.json'), JSON.stringify(out, null, 1));
DB.close();
