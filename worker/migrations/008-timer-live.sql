-- 2026-10-02, audit batch 6 (review round 1, M2): the minute cron's "Timer done" job reads only the live Timer rows.
-- A partial index of the Timer's rows that are not tombstones: the job's two queries (person timer:<id> rows, family
-- run:<owner>:<id> mirrors) step through the live timers only, however many timers were ever started. Old tombstones are
-- also deleted by the job itself (once an hour, older than 30 days), so the table stays small too.
--   Export first:  npx wrangler d1 export house-hub --remote --output <backup.sql>
--   Run:           npx wrangler d1 execute house-hub --remote --file migrations/008-timer-live.sql
-- Idempotent (IF NOT EXISTS). Without it the job still works, reading the whole Timer range.
CREATE INDEX IF NOT EXISTS app_data_timer_live ON app_data (scope, key) WHERE app_id = 'timer' AND value IS NOT NULL;
