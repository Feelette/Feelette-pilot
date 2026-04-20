-- Feelette Pilot Schema v2
-- Adds: email column for optional contact info

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(3) NOT NULL,
  name VARCHAR(100) NOT NULL,
  group_code VARCHAR(50) NOT NULL DEFAULT 'pilot',
  color VARCHAR(20) NOT NULL DEFAULT '#378ADD',
  group_type VARCHAR(20) NOT NULL DEFAULT 'family',
  current_value INTEGER NOT NULL DEFAULT 50,
  email VARCHAR(200),
  last_state_update TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(code, group_code)
);

-- Add email column to existing tables (safe if already exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS time_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_code VARCHAR(50) NOT NULL,
  seconds_given NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gifts_from ON time_gifts(from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gifts_to ON time_gifts(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gifts_group ON time_gifts(group_code, created_at DESC);
