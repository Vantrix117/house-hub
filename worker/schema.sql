-- Run this once in the D1 console after creating the database.
CREATE TABLE IF NOT EXISTS leftovers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  size       TEXT NOT NULL DEFAULT '',
  dateLogged TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS leftovers_date ON leftovers (dateLogged);
