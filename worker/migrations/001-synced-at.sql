-- 2026-09-16: server-side timestamp so incremental pulls don't depend on client clocks.
-- Already applied to the live DB. New databases get the column from schema.sql.
ALTER TABLE app_data ADD COLUMN synced_at INTEGER NOT NULL DEFAULT 0;
UPDATE app_data SET synced_at = updated_at WHERE synced_at = 0;
DROP INDEX IF EXISTS app_data_pull;
CREATE INDEX IF NOT EXISTS app_data_pull ON app_data (app_id, scope, profile_id, synced_at);
