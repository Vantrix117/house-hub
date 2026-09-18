-- 2026-09-17: the legacy Larder Ledger table and its /items routes are gone (everything lives in app_data since Phase 3).
-- Run once on the live DB:  npx wrangler d1 execute house-hub --remote --file migrations/003-drop-legacy.sql
DROP TABLE IF EXISTS leftovers;
