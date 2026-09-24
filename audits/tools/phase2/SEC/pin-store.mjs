// SEC (1): how PINs, pairing codes and session tokens are stored. In-process: the real worker/src code on a fresh
// in-memory D1 (lib/d1.mjs) seeded with the rig's 'empty' household, so the database rows can be read directly.
// Nothing leaves the process; no browser. Run:  node "audits/tools/phase2/SEC/pin-store.mjs"
process.env.TZ = 'America/New_York';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/SEC');
globalThis.fetch = async u => { throw new Error('outbound fetch refused in this experiment: ' + (u.url || u)); };
globalThis.caches = { default: { async match() {}, async put() {} } };

const worker = (await import(pathToFileURL(path.join(ROOT, 'worker/src/index.js')).href)).default;
const { createD1 } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/d1.mjs')).href);
const { seedDemo, DEVICE } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/seed.mjs')).href);
const { hashSecret } = await import(pathToFileURL(path.join(ROOT, 'worker/src/auth.js')).href);

const DB = createD1(':memory:');
await seedDemo(DB, { variant: 'empty', now: Date.now() });
const env = { DB, ALLOWED_ORIGINS: 'http://localhost:8765' };
const ctx = { waitUntil() {}, passThroughOnException() {} };
async function call(p, { method = 'GET', body, dt, pt } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (dt) h['X-Device-Token'] = dt; if (pt) h['X-Profile-Token'] = pt;
  const r = await worker.fetch(new Request('http://api.local' + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, ctx);
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j, raw: t };
}
const out = {};

// a throwaway pairing code so a second device can pair through the real route
const CODE = 'throwaway-pair-' + Math.random().toString(36).slice(2, 8);
DB.sqlite.prepare("UPDATE settings SET value = ? WHERE key = 'pairing_code_hash'").run(await hashSecret(CODE));
const pair = await call('/api/pair', { method: 'POST', body: { code: CODE, name: 'Experiment phone' } });
out.pair = { status: pair.status, token_len: pair.body.device_token && pair.body.device_token.length };
const dt = pair.body.device_token;

// Mea has no PIN in the rig household: create one on first tap, then sign in with it
const PIN = '4827';
const create = await call('/api/profiles/niece/pin', { method: 'POST', body: { pin: PIN }, dt });
out.create = { status: create.status, returns_pin_hash: /pbkdf2|pin_hash/.test(create.raw), profile_keys: Object.keys(create.body.profile || {}) };
const login = await call('/api/login', { method: 'POST', body: { profile_id: 'niece', pin: PIN }, dt });
out.login = { status: login.status, returns_pin_hash: /pbkdf2|pin_hash/.test(login.raw), token_len: login.body.profile_token && login.body.profile_token.length };

// what the database holds
const row = DB.sqlite.prepare("SELECT pin_hash FROM profiles WHERE id = 'niece'").get();
const [algo, iter, salt, hash] = row.pin_hash.split(':');
out.db_pin_hash = { format: `${algo}:${iter}:<salt ${salt.length} chars>:<hash ${hash.length} chars>`, contains_plain_pin: row.pin_hash.includes(PIN) };
const pc = DB.sqlite.prepare("SELECT value FROM settings WHERE key = 'pairing_code_hash'").get().value;
out.db_pairing_code = { format: pc.split(':').slice(0, 2).join(':') + ':<salt>:<hash>', contains_plain_code: pc.includes(CODE) };
const sess = DB.sqlite.prepare("SELECT token_hash, device_id, created_at, expires_at FROM sessions WHERE profile_id = 'niece'").all();
out.db_sessions = sess.map(s => ({ token_hash_len: s.token_hash.length, equals_plain_token: s.token_hash === login.body.profile_token, lifetime_days: Math.round((s.expires_at - s.created_at) / 86400000), device_id: s.device_id }));
const dev = DB.sqlite.prepare('SELECT token_hash FROM devices WHERE id = ?').get(pair.body.device_id);
out.db_device = { token_hash_len: dev.token_hash.length, equals_plain_token: dev.token_hash === dt };

// every profile listing: is any hash exposed?
const profiles = await call('/api/profiles', { dt });
out.profiles_expose_hash = /pbkdf2|pin_hash/.test(profiles.raw);
out.profiles_fields = Object.keys(profiles.body.profiles[0]);

// verification cost of one guess (the PBKDF2 at 10,000 iterations)
const t0 = performance.now(); for (let i = 0; i < 20; i++) await (await import(pathToFileURL(path.join(ROOT, 'worker/src/auth.js')).href)).verifySecret('0000', row.pin_hash);
out.verify_ms_per_guess_node = +((performance.now() - t0) / 20).toFixed(2);

// offline brute force of a leaked hash: all 10,000 4-digit PINs against this row
const { verifySecret } = await import(pathToFileURL(path.join(ROOT, 'worker/src/auth.js')).href);
const t1 = performance.now(); let found = null;
for (let n = 0; n < 10000 && !found; n++) { const g = String(n).padStart(4, '0'); if (await verifySecret(g, row.pin_hash)) found = g; }
out.offline_crack = { found_matches_pin: found === PIN, ms: Math.round(performance.now() - t1), note: 'single Node thread, no GPU' };

console.log(JSON.stringify(out, null, 1));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'pin-store.json'), JSON.stringify(out, null, 1));
DB.close();
