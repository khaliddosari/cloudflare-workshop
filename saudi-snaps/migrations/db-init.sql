-- Saudi Snaps — initial schema
CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  photo_key   TEXT NOT NULL,
  caption     TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT 'Guest',
  colo        TEXT NOT NULL DEFAULT '',
  city        TEXT NOT NULL DEFAULT '',
  country     TEXT NOT NULL DEFAULT '',
  r2_ms       INTEGER,
  ai_ms       INTEGER,
  cached      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
