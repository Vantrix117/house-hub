-- One-time: copy legacy leftovers rows into family-scope app_data (app 'leftovers', key 'item:<id>').
-- Idempotent. The legacy table is left in place until Phase 3.
INSERT INTO app_data (scope, profile_id, app_id, key, value, updated_at)
SELECT 'family', NULL, 'leftovers', 'item:' || l.id,
       json_object('id', l.id, 'name', l.name, 'size', l.size, 'dateLogged', l.dateLogged),
       CAST(strftime('%s', l.dateLogged) AS INTEGER) * 1000
FROM leftovers l
WHERE NOT EXISTS (
  SELECT 1 FROM app_data a
  WHERE a.scope = 'family' AND a.app_id = 'leftovers' AND a.key = 'item:' || l.id
);
