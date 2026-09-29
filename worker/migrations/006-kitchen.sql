-- 2026-09-28, audit batch 0d: the Kitchen device (KITCHEN-1), one-time PIN reset codes (P2-PROF-04) and admin-assigned
-- colour families (audits/05-decisions.md, "Admin-assigned colours").
--   Export first:  npx wrangler d1 export house-hub --remote --output <backup.sql>
--   Run once:      npx wrangler d1 execute house-hub --remote --file migrations/006-kitchen.sql
--
-- The first statement fails on a second run ("duplicate column name: role") before anything else changes.
--
-- SQLite cannot alter a CHECK constraint, so widening profiles.kind to take 'kitchen' rebuilds the table: new table,
-- copy every row column for column, drop, rename. Nothing references profiles by foreign key (sessions.profile_id and
-- app_data.profile_id are plain text), so sessions and data are untouched. Check it with the row count and a
-- column-by-column compare against the export (audits/tools/phase6/0d/migration-check.mjs).
ALTER TABLE devices ADD COLUMN role TEXT;                 -- NULL = an ordinary device; 'kitchen' = the shared kitchen device

CREATE TABLE profiles_new (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '🙂',
  color      TEXT NOT NULL DEFAULT '#5B6FA8',
  kind       TEXT NOT NULL CHECK (kind IN ('adult','kid','kiosk','kitchen')),
  pin_hash   TEXT,
  is_admin   INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  photo      TEXT,
  is_guest   INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  expires_at INTEGER,
  hue               TEXT,                               -- one of the 18 colour family names, set by the admin; NULL = from color
  pin_reset_hash    TEXT,                               -- the one-time code of an admin reset (hashed), NULL = none pending
  pin_reset_expires INTEGER                             -- ms since epoch; the code stops working after this
);
INSERT INTO profiles_new (id, name, emoji, color, kind, pin_hash, is_admin, sort_order, photo, is_guest, created_by, expires_at)
  SELECT id, name, emoji, color, kind, pin_hash, is_admin, sort_order, photo, is_guest, created_by, expires_at FROM profiles;
DROP TABLE profiles;
ALTER TABLE profiles_new RENAME TO profiles;

-- The kitchen profile: not a person, never in a picker, signs in only on a device the admin marked as the kitchen.
INSERT OR IGNORE INTO profiles (id, name, emoji, color, kind, pin_hash, is_admin, sort_order)
  VALUES ('kitchen', 'Kitchen', '🍳', '#5E7A6E', 'kitchen', NULL, 0, 9);
