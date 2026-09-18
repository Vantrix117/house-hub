-- Household profiles. INSERT OR IGNORE: re-running never overwrites edits made in the admin panel.
-- Adults start with pin_hash NULL and create their PIN on first tap.
INSERT OR IGNORE INTO profiles (id, name, emoji, color, kind, pin_hash, is_admin, sort_order) VALUES
  ('eli',       'Eli',           '🧭', '#4F5D8C', 'adult', NULL, 1, 1),
  ('christian', 'Mae',           '🌸', '#BC5A38', 'adult', NULL, 0, 2),
  ('ezra',      'Ezra',          '🦖', '#137F77', 'kid',   NULL, 0, 3),
  ('kiara',     'Kiara',         '🦄', '#B4861B', 'kid',   NULL, 0, 4),
  ('mom',       'Elizabeth',     '🌷', '#8A6A4B', 'adult', NULL, 0, 5),
  ('dad',       'David',         '🎣', '#3D5A3D', 'adult', NULL, 0, 6),
  ('niece',     'Mea',           '🌻', '#5B8143', 'adult', NULL, 0, 7),
  ('tv',        'Downstairs TV', '📺', '#4C4C58', 'kiosk', NULL, 0, 8);
