-- House Hub schema. Idempotent: safe to re-run.
--   npx wrangler d1 execute house-hub --remote --file schema.sql

CREATE TABLE IF NOT EXISTS profiles (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '🙂',
  color      TEXT NOT NULL DEFAULT '#5B6FA8',
  kind       TEXT NOT NULL CHECK (kind IN ('adult','kid','kiosk')),
  pin_hash   TEXT,                          -- NULL = adult has not created a PIN yet
  is_admin   INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  photo      TEXT,                           -- random token; the bytes are media 'photos/<id>/<token>-256.jpg' + '-1024.jpg'
  is_guest   INTEGER NOT NULL DEFAULT 0,     -- guest profiles (migrations/005): added on demand by an adult, kind 'adult', never admin
  created_by TEXT,                            -- guest: the profile id that added them
  expires_at INTEGER                          -- guest: ms since epoch after which the picker hides them; NULL = keep
);

-- Photo bytes (profile photos, the family album) when there is no R2 bucket bound as MEDIA. See src/media.js.
CREATE TABLE IF NOT EXISTS media (
  key        TEXT PRIMARY KEY,
  mime       TEXT NOT NULL DEFAULT 'image/jpeg',
  bytes      BLOB NOT NULL,
  size       INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- One row per (scope, owner, app, key). value is JSON text; NULL value = tombstone (deleted).
-- updated_at is ms since epoch from the writer's clock; last write wins.
CREATE TABLE IF NOT EXISTS app_data (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  scope      TEXT NOT NULL CHECK (scope IN ('person','family')),
  profile_id TEXT,                          -- NULL for family scope
  app_id     TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT,
  updated_at INTEGER NOT NULL,           -- writer's clock: decides last-write-wins
  synced_at  INTEGER NOT NULL DEFAULT 0  -- server clock: what `?since=` filters on
);
-- SQLite treats NULLs as distinct in UNIQUE constraints, so family rows need the IFNULL.
CREATE UNIQUE INDEX IF NOT EXISTS app_data_uq ON app_data (scope, IFNULL(profile_id, ''), app_id, key);
CREATE INDEX IF NOT EXISTS app_data_pull ON app_data (app_id, scope, profile_id, synced_at);

CREATE TABLE IF NOT EXISTS devices (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  paired_at  INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL
);

-- Profile sign-ins. A session is bound to the device that created it.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  device_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT,
  app_id     TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_created ON activity (created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id   TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  subscription TEXT NOT NULL,               -- PushSubscription JSON
  created_at   INTEGER NOT NULL,
  UNIQUE (profile_id, device_id)
);

CREATE TABLE IF NOT EXISTS push_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT,
  kind       TEXT NOT NULL,
  ok         INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_log_profile ON chat_log (profile_id, created_at);

-- pairing_code_hash, vapid_public_key, ...
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
