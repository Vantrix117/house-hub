// The demo household seed. Builds a fresh database for one variant:
//   empty     profiles only (PINs, one device) — every app in its empty state
//   typical   a realistic Tuesday morning: lists, progress, prayers, stars, feed, album, one guest
//   overflow  long names and many items everywhere, to find clipping and overflow
//   park      typical plus a park day: fresh family locations and a meeting point on the park map
//
// Used by lib/server.mjs on every reset; also runnable on its own to inspect a variant:
//   node audits/tools/seed.mjs typical            (prints a summary of what was seeded)
//
// Core rows (profiles, PINs, guests, devices, sessions, photos) are made here. Each app's rows come from
// audits/tools/seed/<app>.mjs, a default-exported function (h) => void, run in SEED_ORDER below.
// Nothing here is a real secret: PINs and the pairing code are random per run and never written anywhere.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HOUSEHOLD, LONG_NAMES, GUESTS, PHOTOS } from './seed/story.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
export const VARIANTS = ['empty', 'typical', 'overflow', 'park'];

// Order matters when a module reads rows another wrote (h.get). Modules that do not exist yet are skipped.
export const SEED_ORDER = ['f260', 'leftovers', 'prayer', 'tally', 'timer', 'kidverse', 'verses', 'dollywood', 'dollywood-live', 'shell', 'chat'];

export const DEVICE = { id: 'rig-kitchen-ipad', token: 'capture-rig-device-token', name: 'Kitchen iPad' };
export const sessionToken = id => 'capture-rig-session-' + id;

const pad = n => String(n).padStart(2, '0');
const sha256b64url = s => crypto.createHash('sha256').update(s).digest('base64url');

export async function seedDemo(DB, { variant = 'typical', now = Date.now(), assets = '' } = {}) {
  if (!VARIANTS.includes(variant)) throw new Error('unknown variant ' + variant);
  const db = DB.sqlite;
  db.exec(fs.readFileSync(path.join(ROOT, 'worker/schema.sql'), 'utf8'));
  db.exec(fs.readFileSync(path.join(ROOT, 'worker/seed.sql'), 'utf8'));
  const { hashSecret } = await import(pathToFileURL(path.join(ROOT, 'worker/src/auth.js')).href);

  const h = helpers(db, variant, now, assets);

  // profiles: PINs for adults who have made one; long names in overflow
  for (const [id, p] of Object.entries(HOUSEHOLD)) {
    if (p.pin) db.prepare('UPDATE profiles SET pin_hash = ? WHERE id = ?').run(await hashSecret(String(crypto.randomInt(1000, 10000))), id);
    if (variant === 'overflow') db.prepare('UPDATE profiles SET name = ? WHERE id = ?').run(LONG_NAMES[id], id);
  }
  // guests
  const gvar = variant === 'park' ? 'typical' : variant;
  let sort = 20;
  for (const g of GUESTS[gvar] || []) {
    const exp = g.expires == null ? null : (g.expires > 0 && g.expires < 1 ? h.time(0, '23:59') : g.expires < 0 ? now + g.expires * 86400000 : h.time(g.expires, '23:59'));
    db.prepare(`INSERT INTO profiles (id, name, emoji, color, kind, pin_hash, is_admin, sort_order, is_guest, created_by, expires_at)
      VALUES (?, ?, ?, ?, 'adult', ?, 0, ?, 1, ?, ?)`).run(g.id, g.name, g.emoji, g.color, g.pin ? await hashSecret(String(crypto.randomInt(1000, 10000))) : null, sort++, g.by, exp);
  }
  // devices: the capture device plus a realistic list for the admin panel
  const dev = (id, name, token, pairedDays, seenMin) => db.prepare('INSERT INTO devices (id, name, token_hash, paired_at, last_seen) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, sha256b64url(token), now - pairedDays * 86400000, now - seenMin * 60000);
  dev(DEVICE.id, DEVICE.name, DEVICE.token, 6, 0);
  if (variant !== 'empty') {
    dev('rig-eli-iphone', "Eli's iPhone", crypto.randomUUID(), 6, 12);
    dev('rig-tv', 'Downstairs TV', crypto.randomUUID(), 5, 1);
    dev('rig-mae-iphone', "Mae's iPhone", crypto.randomUUID(), 5, 95);
    dev('rig-desktop', 'Study PC', crypto.randomUUID(), 3, 60 * 26);
  }
  // one session per profile on the capture device (tokens are fixed strings: local demo only)
  const ids = db.prepare('SELECT id FROM profiles').all().map(r => r.id);
  for (const id of ids) db.prepare('INSERT INTO sessions (token_hash, profile_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(sha256b64url(sessionToken(id)), id, DEVICE.id, now - 86400000, now + 300 * 86400000);
  // the pairing code: random, never shown — the pairing capture only ever types a wrong one
  db.prepare("INSERT INTO settings (key, value) VALUES ('pairing_code_hash', ?)").run(await hashSecret(crypto.randomBytes(9).toString('base64url')));
  // profile photos
  if (variant !== 'empty') for (const [id, asset] of Object.entries(PHOTOS)) {
    const sm = h.asset(asset + '-256.jpg'), lg = h.asset(asset + '-1024.jpg');
    if (!sm || !lg) continue;
    const token = 'rigphoto' + id;
    h.media(`photos/${id}/${token}-256.jpg`, sm);
    h.media(`photos/${id}/${token}-1024.jpg`, lg);
    db.prepare('UPDATE profiles SET photo = ? WHERE id = ?').run(token, id);
  }

  // app data
  const ran = [];
  for (const name of SEED_ORDER) {
    const file = path.join(HERE, 'seed', name + '.mjs');
    if (!fs.existsSync(file)) continue;
    const mod = await import(pathToFileURL(file).href + '?v=' + fs.statSync(file).mtimeMs);
    await mod.default(h);
    ran.push(name);
  }
  return {
    device: DEVICE,
    sessions: Object.fromEntries(ids.map(id => [id, sessionToken(id)])),
    seeded: ran,
    counts: Object.fromEntries(['app_data', 'activity', 'chat_log', 'media', 'profiles'].map(t => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n])),
  };
}

// ── helpers handed to every app seed module ───────────────────────────────────
function helpers(db, variant, now, assets) {
  const base = variant === 'park' ? 'typical' : variant;
  const local = ms => { const d = new Date(ms); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; };
  let seq = 0;
  const h = {
    variant,                 // 'empty' | 'typical' | 'overflow' | 'park'
    base,                    // 'park' counts as 'typical' for everything but the park itself
    park: variant === 'park',
    empty: base === 'empty', typical: base === 'typical', overflow: base === 'overflow',
    now,
    profiles: () => db.prepare('SELECT * FROM profiles ORDER BY sort_order').all(),
    name: id => (db.prepare('SELECT name FROM profiles WHERE id = ?').get(id) || {}).name,
    /** 'YYYY-MM-DD' in New York for today + offset days (negative = past). */
    day(offset = 0) { const { y, m, d } = local(now + offset * 86400000); return `${y}-${pad(m)}-${pad(d)}`; },
    /** Epoch ms for local time 'HH:MM' on today + offset days. */
    time(offset = 0, hhmm = '12:00') { const { y, m, d } = local(now + offset * 86400000); const [H, M] = hhmm.split(':').map(Number); return new Date(y, m - 1, d, H, M).getTime(); },
    /** Epoch ms `mins` minutes before now. */
    ago(mins) { return now - mins * 60000; },
    /** ISO week 'YYYY-Www' (the same rule as index.html isoWeek) for today + offset days. */
    isoWeek(offset = 0) {
      const dt = new Date(now + offset * 86400000); const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
      const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
      return `${y}-W${pad(w)}`;
    },
    /** A deterministic id: prefix + zero-padded counter. */
    uid(prefix = 'r') { seq++; return prefix + pad(seq).padStart(4, '0'); },
    /** Write one app_data row. scope 'person' needs a profile id; 'family' passes null. `value: null` is a tombstone. */
    put(scope, profileId, app, key, value, at = now - 5 * 60000) {
      db.prepare(`INSERT INTO app_data (scope, profile_id, app_id, key, value, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (scope, IFNULL(profile_id, ''), app_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, synced_at = excluded.synced_at`)
        .run(scope, scope === 'family' ? null : profileId, app, key, value === null ? null : JSON.stringify(value), Math.round(at), Math.round(at));
    },
    person(profileId, app, key, value, at) { h.put('person', profileId, app, key, value, at); },
    family(app, key, value, at) { h.put('family', null, app, key, value, at); },
    /** Read a row another module wrote (null if missing). */
    get(scope, profileId, app, key) {
      const r = db.prepare('SELECT value FROM app_data WHERE scope = ? AND IFNULL(profile_id, \'\') = ? AND app_id = ? AND key = ?').get(scope, scope === 'family' ? '' : profileId, app, key);
      return r && r.value != null ? JSON.parse(r.value) : null;
    },
    list(scope, profileId, app, prefix = '') {
      return db.prepare('SELECT key, value FROM app_data WHERE scope = ? AND IFNULL(profile_id, \'\') = ? AND app_id = ? AND key LIKE ?').all(scope, scope === 'family' ? '' : profileId, app, prefix + '%')
        .filter(r => r.value != null).map(r => ({ key: r.key, value: JSON.parse(r.value) }));
    },
    /** A family-feed line (what hub.activity posts). */
    activity(profileId, app, text, at) { db.prepare('INSERT INTO activity (profile_id, app_id, text, created_at) VALUES (?, ?, ?, ?)').run(profileId, app, String(text).slice(0, 200), Math.round(at)); },
    /** A push_log row (what Me → Admin → Usage counts): kind 'leftovers'|'f260'|'behind'|'prayer'|'park'|'rally'|'test', ok true/false. */
    push(profileId, kind, ok, at) { db.prepare('INSERT INTO push_log (profile_id, kind, ok, created_at) VALUES (?, ?, ?, ?)').run(profileId, kind, ok ? 1 : 0, Math.round(at)); },
    /** A chat_log row (role 'user' | 'assistant'). */
    chat(profileId, role, content, at) { db.prepare('INSERT INTO chat_log (profile_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(profileId, role, content, Math.round(at)); },
    /** Store media bytes under a key (served at /api/media/<key>). */
    media(key, bytes) { db.prepare('INSERT OR REPLACE INTO media (key, mime, bytes, size, created_at) VALUES (?, ?, ?, ?, ?)').run(key, 'image/jpeg', bytes, bytes.length, now); },
    /** Bytes of a rendered asset (JPEG) from the assets folder, or null when the driver has not rendered it. */
    asset(name) { const f = assets && path.join(assets, name); return f && fs.existsSync(f) ? new Uint8Array(fs.readFileSync(f)) : null; },
    assetNames() { return assets && fs.existsSync(assets) ? fs.readdirSync(assets) : []; },
  };
  return h;
}

// CLI: seed a variant into a throwaway database and print what went in.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.env.TZ = 'America/New_York';
  const { createD1 } = await import(pathToFileURL(path.join(HERE, 'lib/d1.mjs')).href);
  const { DEMO_TIME } = await import(pathToFileURL(path.join(HERE, 'seed/story.mjs')).href);
  const variant = process.argv[2] || 'typical';
  const DB = createD1(':memory:');
  const out = await seedDemo(DB, { variant, now: Date.parse(DEMO_TIME), assets: process.env.HUB_AUDIT_ASSETS || '' });
  const rows = DB.sqlite.prepare("SELECT scope, IFNULL(profile_id,'family') AS who, app_id, COUNT(*) AS n FROM app_data GROUP BY 1,2,3 ORDER BY 3,2").all();
  console.log(JSON.stringify({ variant, ...out, sessions: Object.keys(out.sessions) }, null, 1));
  console.table(rows);
}
