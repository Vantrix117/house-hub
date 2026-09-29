-- Household profiles. INSERT OR IGNORE: re-running never overwrites edits made in the admin panel.
-- Adults start with pin_hash NULL and create their PIN on first tap. hue: the starting colour families (D3, migrations/007).
INSERT OR IGNORE INTO profiles (id, name, emoji, color, kind, pin_hash, is_admin, sort_order, hue) VALUES
  ('eli',       'Eli',           '🧭', '#4F5D8C', 'adult', NULL, 1, 1, 'periwinkle'),
  ('christian', 'Mae',           '🌸', '#BC5A38', 'adult', NULL, 0, 2, 'peach'),
  ('ezra',      'Ezra',          '🦖', '#137F77', 'kid',   NULL, 0, 3, 'aqua'),
  ('kiara',     'Kiara',         '🦄', '#B4861B', 'kid',   NULL, 0, 4, 'lavender'),
  ('mom',       'Elizabeth',     '🌷', '#8A6A4B', 'adult', NULL, 0, 5, 'bubblegum'),
  ('dad',       'David',         '🎣', '#3D5A3D', 'adult', NULL, 0, 6, 'mint'),
  ('niece',     'Mea',           '🌻', '#5B8143', 'adult', NULL, 0, 7, 'butter'),
  ('tv',        'Downstairs TV', '📺', '#4C4C58', 'kiosk', NULL, 0, 8, 'graphite'),
  ('kitchen',   'Kitchen',       '🍳', '#5E7A6E', 'kitchen', NULL, 0, 9, 'graphite');   -- the shared kitchen device's profile (migrations/006)
