BEGIN;
CREATE TABLE IF NOT EXISTS users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email varchar(254) NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE links ADD COLUMN IF NOT EXISTS user_id bigint REFERENCES users(id);
CREATE INDEX IF NOT EXISTS links_user_created_idx ON links(user_id, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
COMMIT;
