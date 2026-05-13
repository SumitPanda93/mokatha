-- Mehfil LiveKit egress lifecycle + studio (camera) mode + replay processing truth

-- 1) Mehfil session mode (voice vs studio)
ALTER TABLE public.mehfils
  ADD COLUMN IF NOT EXISTS session_mode text NOT NULL DEFAULT 'voice';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mehfils_session_mode_check'
  ) THEN
    ALTER TABLE public.mehfils
      ADD CONSTRAINT mehfils_session_mode_check
      CHECK (session_mode IN ('voice', 'studio'));
  END IF;
END $$;

ALTER TABLE public.mehfils
  ADD COLUMN IF NOT EXISTS egress_id text;

COMMENT ON COLUMN public.mehfils.session_mode IS 'voice = audio-first salon; studio = optional host camera (LiveKit video)';
COMMENT ON COLUMN public.mehfils.egress_id IS 'Active LiveKit egress job id while recording; cleared after stop request';

-- 2) Replay pipeline state (single lifecycle surface for hosts + webhook)
ALTER TABLE public.mehfil_replays
  ADD COLUMN IF NOT EXISTS replay_processing_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mehfil_replays_processing_status_check'
  ) THEN
    ALTER TABLE public.mehfil_replays
      ADD CONSTRAINT mehfil_replays_processing_status_check
      CHECK (
        replay_processing_status IN (
          'pending',
          'recording',
          'processing',
          'ready',
          'failed'
        )
      );
  END IF;
END $$;

ALTER TABLE public.mehfil_replays
  ADD COLUMN IF NOT EXISTS egress_id text;

ALTER TABLE public.mehfil_replays
  ADD COLUMN IF NOT EXISTS recording_error text;

ALTER TABLE public.mehfil_replays
  ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN public.mehfil_replays.replay_processing_status IS 'Live egress lifecycle: pending→recording→processing→ready|failed';

-- Backfill legacy rows
UPDATE public.mehfil_replays
SET replay_processing_status = 'ready'
WHERE audio_url IS NOT NULL AND trim(audio_url) <> '';

UPDATE public.mehfil_replays
SET replay_processing_status = 'pending'
WHERE audio_url IS NULL OR trim(audio_url) = '';

-- Realtime: hosts see replay row updates while processing completes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mehfil_replays'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mehfil_replays;
  END IF;
END $$;
