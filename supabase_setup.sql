-- ============================================
-- Run this SQL in your Supabase Dashboard:
--   SQL Editor → New Query → Paste & Run
-- ============================================

CREATE TABLE IF NOT EXISTS user_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  progress_state  JSONB    DEFAULT '{}',
  ca_level        TEXT     DEFAULT 'Intermediate',
  study_target    INTEGER  DEFAULT 6,
  total_hours     NUMERIC  DEFAULT 0,
  email           TEXT,
  full_name       TEXT,
  is_active       BOOLEAN  DEFAULT TRUE,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Add columns if they do not exist (migration helper for existing tables)
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Enable Row Level Security so each user only sees their own data
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if we are re-running to avoid errors
DROP POLICY IF EXISTS "Users can view own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
DROP POLICY IF EXISTS "Admins can view all user progress" ON user_progress;
DROP POLICY IF EXISTS "Admins can update all user progress" ON user_progress;

-- User Policies
CREATE POLICY "Users can view own progress"
  ON user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_active = true);

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  USING (auth.uid() = user_id AND is_active = true)
  WITH CHECK (auth.uid() = user_id AND is_active = true);

-- Admin Policies
CREATE POLICY "Admins can view all user progress"
  ON user_progress FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true OR
    auth.jwt() ->> 'email' = 'chitranshagrawal005@gmail.com' OR
    auth.jwt() ->> 'email' = 'admin@gmail.com' OR
    auth.jwt() ->> 'email' LIKE '%@canextdoor.com'
  );

CREATE POLICY "Admins can update all user progress"
  ON user_progress FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true OR
    auth.jwt() ->> 'email' = 'chitranshagrawal005@gmail.com' OR
    auth.jwt() ->> 'email' = 'admin@gmail.com' OR
    auth.jwt() ->> 'email' LIKE '%@canextdoor.com'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true OR
    auth.jwt() ->> 'email' = 'chitranshagrawal005@gmail.com' OR
    auth.jwt() ->> 'email' = 'admin@gmail.com' OR
    auth.jwt() ->> 'email' LIKE '%@canextdoor.com'
  );

-- ============================================
-- Dynamic Mock Test Papers Table
-- ============================================

CREATE TABLE IF NOT EXISTS mock_papers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level        TEXT NOT NULL,
  subject      TEXT NOT NULL,
  title        TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('MCQ', 'Subjective')),
  total_marks  INTEGER NOT NULL,
  questions    JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE mock_papers ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for the table by setting replica identity to full
ALTER TABLE mock_papers REPLICA IDENTITY FULL;

-- Policies:
-- 1. Students and Admins can read all mock papers
CREATE POLICY "Allow public read access to mock papers"
  ON mock_papers FOR SELECT
  USING (true);

-- 2. Only authenticated administrators can insert, update, or delete papers
CREATE POLICY "Allow admin write access to mock papers"
  ON mock_papers FOR ALL
  USING (auth.role() = 'authenticated' AND (
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true OR
    auth.jwt() ->> 'email' = 'chitranshagrawal005@gmail.com' OR
    auth.jwt() ->> 'email' = 'admin@gmail.com' OR
    auth.jwt() ->> 'email' LIKE '%@canextdoor.com'
  ))
  WITH CHECK (auth.role() = 'authenticated' AND (
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true OR
    auth.jwt() ->> 'email' = 'chitranshagrawal005@gmail.com' OR
    auth.jwt() ->> 'email' = 'admin@gmail.com' OR
    auth.jwt() ->> 'email' LIKE '%@canextdoor.com'
  ));

-- Add mock_papers to Supabase realtime publication if not already added
-- NOTE: If this fails in SQL editor because publication doesn't exist, ignore or create it
-- ALTER PUBLICATION supabase_realtime ADD TABLE mock_papers;

-- ============================================
-- Dynamic Global Subjects Table
-- ============================================

CREATE TABLE IF NOT EXISTS global_subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level       TEXT NOT NULL,
  name        TEXT NOT NULL,
  chapters    JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE global_subjects ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for the table by setting replica identity to full
ALTER TABLE global_subjects REPLICA IDENTITY FULL;

-- Policies:
-- 1. Anyone can view global subjects
CREATE POLICY "Allow public read access to global subjects"
  ON global_subjects FOR SELECT
  USING (true);

-- 2. Only authenticated admins can write to global subjects
CREATE POLICY "Allow admin write access to global subjects"
  ON global_subjects FOR ALL
  USING (auth.role() = 'authenticated' AND (
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true OR
    auth.jwt() ->> 'email' = 'chitranshagrawal005@gmail.com' OR
    auth.jwt() ->> 'email' = 'admin@gmail.com' OR
    auth.jwt() ->> 'email' LIKE '%@canextdoor.com'
  ))
  WITH CHECK (auth.role() = 'authenticated' AND (
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true OR
    auth.jwt() ->> 'email' = 'chitranshagrawal005@gmail.com' OR
    auth.jwt() ->> 'email' = 'admin@gmail.com' OR
    auth.jwt() ->> 'email' LIKE '%@canextdoor.com'
  ));

-- Add global_subjects to Supabase realtime publication
-- ALTER PUBLICATION supabase_realtime ADD TABLE global_subjects;

