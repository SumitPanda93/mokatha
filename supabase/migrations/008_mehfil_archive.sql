-- Add archived flag to mehfils for creator management
ALTER TABLE mehfils ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Index for filtering out archived mehfils efficiently
CREATE INDEX IF NOT EXISTS mehfils_archived_idx ON mehfils (archived, starts_at DESC);

-- RLS: allow host to update their own mehfil (covers archive + end actions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mehfils' AND policyname = 'mehfils_host_update'
  ) THEN
    CREATE POLICY mehfils_host_update ON mehfils
      FOR UPDATE USING (auth.uid() = host_id);
  END IF;
END$$;

-- RLS: allow host to delete their own mehfil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mehfils' AND policyname = 'mehfils_host_delete'
  ) THEN
    CREATE POLICY mehfils_host_delete ON mehfils
      FOR DELETE USING (auth.uid() = host_id);
  END IF;
END$$;
