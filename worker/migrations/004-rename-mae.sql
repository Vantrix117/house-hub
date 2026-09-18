-- 2026-09-17: Christian goes by Mae. Display name only; the profile id stays 'christian' so nothing else moves.
-- Run once on the live DB:  npx wrangler d1 execute house-hub --remote --file migrations/004-rename-mae.sql
UPDATE profiles SET name = 'Mae' WHERE id = 'christian' AND name = 'Christian';
