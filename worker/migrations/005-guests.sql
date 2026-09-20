-- 2026-09-20: guest profiles (roadmap item 23).
-- A guest is an adult profile created on demand by a household adult (POST /api/profiles): is_guest = 1,
-- created_by = who added them, expires_at = ms since epoch after which the picker hides them (NULL = keep).
-- Run once on the live DB:  npx wrangler d1 execute house-hub --remote --file migrations/005-guests.sql
-- SQLite has no ADD COLUMN IF NOT EXISTS: a second run fails with "duplicate column name" and changes nothing.
-- (scripts guard on `PRAGMA table_info(profiles)` having no is_guest column before applying this file.)
ALTER TABLE profiles ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN created_by TEXT;
ALTER TABLE profiles ADD COLUMN expires_at INTEGER;
