-- 2026-09-17: profile photos + family album (roadmap item 6).
-- profiles.photo holds a random token; the bytes live in `media` (or in R2 once the MEDIA binding exists).
-- Run once on the live DB:  npx wrangler d1 execute house-hub --remote --file migrations/002-media.sql
ALTER TABLE profiles ADD COLUMN photo TEXT;
CREATE TABLE IF NOT EXISTS media (
  key        TEXT PRIMARY KEY,
  mime       TEXT NOT NULL DEFAULT 'image/jpeg',
  bytes      BLOB NOT NULL,
  size       INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
