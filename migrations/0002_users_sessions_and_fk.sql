-- 0002_users_sessions_and_fk.sql
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  google_sub  TEXT UNIQUE,
  email       TEXT UNIQUE,
  name        TEXT,
  image_url   TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS oauth_state (
  state         TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

ALTER TABLE posts ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
