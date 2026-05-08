-- Migration 010: Enforce handle uniqueness and add suspended column guard
-- Safe to run multiple times.

-- Ensure handle column has a unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_handle_unique' AND conrelid = 'profiles'::regclass
  ) THEN
    -- Normalise existing handles before constraining
    UPDATE profiles SET handle = lower(trim(handle)) WHERE handle IS NOT NULL;
    ALTER TABLE profiles ADD CONSTRAINT profiles_handle_unique UNIQUE (handle);
  END IF;
END $$;

-- Ensure suspended column exists (might already exist from earlier migration)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

-- Create index for fast availability checks
CREATE INDEX IF NOT EXISTS profiles_handle_lower_idx ON profiles (lower(handle));

-- RLS: suspended users cannot see other suspended users' profiles
-- (optional; keep simple for now — suspension is primarily a soft-delete signal)
