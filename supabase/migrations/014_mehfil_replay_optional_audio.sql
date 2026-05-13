-- Allow replay rows before studio audio is attached (live capture pipeline).
--
-- Prerequisite: public.mehfil_replays must exist (created in
-- 011_mehfil_replay_analytics.sql). If you see "relation does not exist",
-- run the full 011 script on this database first, then run this file again.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'mehfil_replays'
  ) THEN
    RAISE EXCEPTION
      'public.mehfil_replays does not exist. Apply migration 011_mehfil_replay_analytics.sql first (creates the table), then re-run 014.';
  END IF;

  ALTER TABLE public.mehfil_replays
    ALTER COLUMN audio_url DROP NOT NULL;
END $$;
