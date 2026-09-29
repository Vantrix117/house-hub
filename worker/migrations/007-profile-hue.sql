-- 2026-09-29, audit batch 1a: each profile's colour family (the `hue` column exists since migrations/006-kitchen.sql).
-- The starting colours are decision D3 (audits/05-decisions.md); the admin may change any of them to any of the 18
-- families ("Admin-assigned colours"). Guests start as sky (D4). The TV and the kitchen are nobody's colour: graphite.
--   Export first:  npx wrangler d1 export house-hub --remote --output <backup.sql>
--   Run:           npx wrangler d1 execute house-hub --remote --file migrations/007-profile-hue.sql
-- Idempotent: every statement only fills a hue that is still NULL, so a second run changes nothing and a colour the
-- admin already chose is never overwritten. Until a session is refreshed (ACCENT-9), the pre-paint bootstrap and hub.js
-- map a stored hex to these same families.
UPDATE profiles SET hue = 'periwinkle' WHERE id = 'eli'       AND hue IS NULL;
UPDATE profiles SET hue = 'peach'      WHERE id = 'christian' AND hue IS NULL;   -- Mae
UPDATE profiles SET hue = 'bubblegum'  WHERE id = 'mom'       AND hue IS NULL;   -- Elizabeth
UPDATE profiles SET hue = 'mint'       WHERE id = 'dad'       AND hue IS NULL;   -- David
UPDATE profiles SET hue = 'butter'     WHERE id = 'niece'     AND hue IS NULL;   -- Mea
UPDATE profiles SET hue = 'aqua'       WHERE id = 'ezra'      AND hue IS NULL;
UPDATE profiles SET hue = 'lavender'   WHERE id = 'kiara'     AND hue IS NULL;
UPDATE profiles SET hue = 'graphite'   WHERE id = 'tv'        AND hue IS NULL;   -- Downstairs TV
UPDATE profiles SET hue = 'graphite'   WHERE id = 'kitchen'   AND hue IS NULL;
UPDATE profiles SET hue = 'sky'        WHERE is_guest = 1     AND hue IS NULL;
