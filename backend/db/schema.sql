-- Feelette Pilot Schema v3
-- Adds: questions, question_answers, favorites tables

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

-- NEW: Questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_code VARCHAR(50) NOT NULL,
  text VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_group ON questions(group_code, created_at DESC);

-- NEW: Question answers (one per user per question, updated in place)
CREATE TABLE IF NOT EXISTS question_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value >= 0 AND value <= 100),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_question ON question_answers(question_id);

-- NEW: Favorites (who this user has starred)
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  favorite_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, favorite_user_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id, created_at DESC);
