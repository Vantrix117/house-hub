// app_data access. Values are JSON; a NULL value is a tombstone so deletes propagate to other devices.
import { HttpError } from './auth.js';

export const MAX_VALUE_BYTES = 900 * 1024;   // D1 rows top out at 1 MB
const KEY_RE = /^[A-Za-z0-9_.:\-\/]{1,200}$/;

export function checkScope(scope) {
  if (scope !== 'person' && scope !== 'family') throw new HttpError(400, 'bad_scope', "scope must be 'person' or 'family'.");
  return scope;
}
export function checkKey(key) {
  if (!KEY_RE.test(key || '')) throw new HttpError(400, 'bad_key', 'Keys are 1–200 chars of letters, digits, . _ : - /');
  return key;
}
const owner = (scope, profile) => (scope === 'person' ? profile.id : null);

/** Lists rows for one app. `since` (ms) makes it incremental; tombstones are included so clients can drop items. */
export async function listData(env, { appId, scope, profile, since = 0, prefix = '' }) {
  const pid = owner(scope, profile);
  const { results } = await env.DB.prepare(
    `SELECT key, value, updated_at FROM app_data
      WHERE app_id = ? AND scope = ? AND profile_id IS ? AND updated_at > ? AND key LIKE ? ESCAPE '\\'
      ORDER BY updated_at ASC`)
    .bind(appId, scope, pid, since, prefix.replace(/[%_]/g, '\$&') + '%').all();
  return results.map(r => ({ key: r.key, value: r.value == null ? null : JSON.parse(r.value), updated_at: r.updated_at }));
}

export async function getOne(env, { appId, scope, profile, key }) {
  const row = await env.DB.prepare(
    'SELECT key, value, updated_at FROM app_data WHERE app_id = ? AND scope = ? AND profile_id IS ? AND key = ?')
    .bind(appId, scope, owner(scope, profile), key).first();
  return row ? { key: row.key, value: row.value == null ? null : JSON.parse(row.value), updated_at: row.updated_at } : null;
}

/**
 * Last-write-wins upsert. Returns the row as it stands after the call plus `applied`
 * (false when the server already had something newer — the client should adopt that).
 */
export async function putOne(env, { appId, scope, profile, key, value, updated_at }) {
  const pid = owner(scope, profile);
  const ts = Number.isFinite(+updated_at) && +updated_at > 0 ? Math.min(+updated_at, Date.now() + 5 * 60000) : Date.now();
  const json = value === undefined || value === null ? null : JSON.stringify(value);
  if (json && json.length > MAX_VALUE_BYTES) throw new HttpError(413, 'value_too_large', 'That is too big to save.');

  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await env.DB.prepare(
      'SELECT id, value, updated_at FROM app_data WHERE app_id = ? AND scope = ? AND profile_id IS ? AND key = ?')
      .bind(appId, scope, pid, key).first();
    if (!cur) {
      try {
        await env.DB.prepare(
          'INSERT INTO app_data (scope, profile_id, app_id, key, value, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(scope, pid, appId, key, json, ts).run();
        return { key, value, updated_at: ts, applied: true };
      } catch (e) {
        if (!/UNIQUE/i.test(String(e.message))) throw e;
        continue;   // lost a race with another insert; re-read and compare timestamps
      }
    }
    if (ts > cur.updated_at) {
      await env.DB.prepare('UPDATE app_data SET value = ?, updated_at = ? WHERE id = ?').bind(json, ts, cur.id).run();
      return { key, value, updated_at: ts, applied: true };
    }
    return { key, value: cur.value == null ? null : JSON.parse(cur.value), updated_at: cur.updated_at, applied: false };
  }
  throw new HttpError(500, 'write_conflict', 'Could not save — please try again.');
}

// Convenience for server-side code (chat tools, cron): live items under a prefix as plain values.
export async function liveItems(env, args) {
  return (await listData(env, args)).filter(r => r.value != null);
}
