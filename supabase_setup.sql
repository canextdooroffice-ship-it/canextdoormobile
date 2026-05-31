-- ============================================
-- Run this SQL in your Supabase Dashboard:
--   SQL Editor → New Query → Paste & Run
-- ============================================

CREATE TABLE IF NOT EXISTS user_progress (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  progress_state  JSONB    DEFAULT '{}',
  ca_level        TEXT     DEFAULT 'Intermediate',
  study_target    INTEGER  DEFAULT 6,
  total_hours     NUMERIC  DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security so each user only sees their own data
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  USING (auth.uid() = user_id);
