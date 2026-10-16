BEGIN;
ALTER TABLE links ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
COMMIT;
