-- Migration 022: Create Mehfil features — category, highlights, entry_type, server drafts

-- ─── Mehfils: dedicated category, highlights, entry type ─────────────────────

ALTER TABLE public.mehfils
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IS NULL OR category IN ('music', 'spiritual', 'talks', 'open-mic'));

ALTER TABLE public.mehfils
  ADD COLUMN IF NOT EXISTS highlights text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.mehfils
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'free'
    CHECK (entry_type IN ('free', 'tip', 'ticket'));

-- is_ticketed, ticket_price, max_speakers added in 009_creator_economy.sql
ALTER TABLE public.mehfils
  ADD COLUMN IF NOT EXISTS is_ticketed boolean NOT NULL DEFAULT false;

ALTER TABLE public.mehfils
  ADD COLUMN IF NOT EXISTS ticket_price numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.mehfils
  ADD COLUMN IF NOT EXISTS max_speakers integer NOT NULL DEFAULT 5;

CREATE INDEX IF NOT EXISTS mehfils_category_idx ON public.mehfils (category)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS mehfils_entry_type_idx ON public.mehfils (entry_type);

-- ─── Mehfil drafts (persist create wizard state) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.mehfil_drafts (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mehfil_drafts_user_updated_idx
  ON public.mehfil_drafts (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_mehfil_drafts_updated_at ON public.mehfil_drafts;
CREATE TRIGGER trg_mehfil_drafts_updated_at
  BEFORE UPDATE ON public.mehfil_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.mehfil_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mehfil_drafts' AND policyname = 'mehfil_drafts_own'
  ) THEN
    CREATE POLICY "mehfil_drafts_own" ON public.mehfil_drafts
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
