-- Migration 021: Create Post features — drafts, visibility, schedule, polls, location, tags, themes

-- ─── Posts: visibility, schedule, location, background theme ─────────────────

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'followers', 'private'));

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS location_name text;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS location_lat double precision;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS location_lng double precision;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS background_theme text;

-- Backfill visibility from legacy is_private
UPDATE public.posts
SET visibility = 'private'
WHERE is_private = true AND visibility = 'public';

CREATE INDEX IF NOT EXISTS posts_scheduled_at_idx ON public.posts (scheduled_at)
  WHERE scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS posts_visibility_idx ON public.posts (visibility);

-- ─── Post drafts (persist create-hub state) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_drafts (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_drafts_user_updated_idx
  ON public.post_drafts (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_post_drafts_updated_at ON public.post_drafts;
CREATE TRIGGER trg_post_drafts_updated_at
  BEFORE UPDATE ON public.post_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.post_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_drafts' AND policyname = 'post_drafts_own'
  ) THEN
    CREATE POLICY "post_drafts_own" ON public.post_drafts
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── Tag people on posts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_user_tags (
  post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_user_tags_user_idx ON public.post_user_tags (user_id);

ALTER TABLE public.post_user_tags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_user_tags' AND policyname = 'post_user_tags_read'
  ) THEN
    CREATE POLICY "post_user_tags_read" ON public.post_user_tags FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_user_tags' AND policyname = 'post_user_tags_insert_author'
  ) THEN
    CREATE POLICY "post_user_tags_insert_author" ON public.post_user_tags
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_user_tags' AND policyname = 'post_user_tags_delete_author'
  ) THEN
    CREATE POLICY "post_user_tags_delete_author" ON public.post_user_tags
      FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
      );
  END IF;
END $$;

-- ─── Polls (one poll per post) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_polls (
  post_id text PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  question text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_poll_options (
  id text PRIMARY KEY,
  post_id text NOT NULL REFERENCES public.post_polls(post_id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  votes int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS post_poll_options_post_idx ON public.post_poll_options (post_id, sort_order);

CREATE TABLE IF NOT EXISTS public.post_poll_votes (
  post_id text NOT NULL REFERENCES public.post_polls(post_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_id text NOT NULL REFERENCES public.post_poll_options(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.post_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_polls' AND policyname = 'post_polls_read'
  ) THEN
    CREATE POLICY "post_polls_read" ON public.post_polls FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_poll_options' AND policyname = 'post_poll_options_read'
  ) THEN
    CREATE POLICY "post_poll_options_read" ON public.post_poll_options FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_poll_votes' AND policyname = 'post_poll_votes_read'
  ) THEN
    CREATE POLICY "post_poll_votes_read" ON public.post_poll_votes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'post_poll_votes' AND policyname = 'post_poll_votes_insert_own'
  ) THEN
    CREATE POLICY "post_poll_votes_insert_own" ON public.post_poll_votes
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Atomic vote: increment option votes, upsert user vote
CREATE OR REPLACE FUNCTION public.cast_poll_vote(p_post_id text, p_option_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_old_option text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.post_poll_options o
    WHERE o.id = p_option_id AND o.post_id = p_post_id
  ) THEN
    RAISE EXCEPTION 'invalid_option';
  END IF;

  SELECT option_id INTO v_old_option
  FROM public.post_poll_votes
  WHERE post_id = p_post_id AND user_id = v_user;

  IF v_old_option IS NOT NULL THEN
    IF v_old_option = p_option_id THEN
      RETURN;
    END IF;
    UPDATE public.post_poll_options SET votes = GREATEST(0, votes - 1) WHERE id = v_old_option;
    UPDATE public.post_poll_votes SET option_id = p_option_id, created_at = now()
    WHERE post_id = p_post_id AND user_id = v_user;
  ELSE
    INSERT INTO public.post_poll_votes (post_id, user_id, option_id)
    VALUES (p_post_id, v_user, p_option_id);
  END IF;

  UPDATE public.post_poll_options SET votes = votes + 1 WHERE id = p_option_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cast_poll_vote(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_poll_vote(text, text) TO authenticated;

-- Optional pg_cron: publish scheduled posts (no-op if extension unavailable)
-- Run manually in Supabase SQL editor after enabling pg_cron:
-- SELECT cron.schedule('publish-scheduled-posts', '* * * * *', $$
--   UPDATE public.posts SET scheduled_at = NULL WHERE scheduled_at IS NOT NULL AND scheduled_at <= now();
-- $$);
-- Client feed also hides scheduled_at > now() for non-authors.
