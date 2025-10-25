-- 0001_init.sql
CREATE TABLE IF NOT EXISTS posts (
  id            TEXT PRIMARY KEY,
  title         TEXT,
  r2_key        TEXT NOT NULL UNIQUE,
  content_type  TEXT NOT NULL,
  size          INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  ip            TEXT,
  transcript    TEXT,
  transcribed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
