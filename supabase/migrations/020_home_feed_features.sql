-- ─── Migration 020: Home feed — stories, mehfil listeners, story storage ─────

-- Ephemeral stories (24h)
CREATE TABLE IF NOT EXISTS public.stories (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS stories_user_expires_idx ON public.stories (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS stories_expires_idx ON public.stories (expires_at);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stories' AND policyname = 'stories_read_active'
  ) THEN
    CREATE POLICY "stories_read_active" ON public.stories
      FOR SELECT USING (expires_at > now());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stories' AND policyname = 'stories_insert_own'
  ) THEN
    CREATE POLICY "stories_insert_own" ON public.stories
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stories' AND policyname = 'stories_delete_own'
  ) THEN
    CREATE POLICY "stories_delete_own" ON public.stories
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Per-user mehfil presence for listener avatar stacks on feed cards
CREATE TABLE IF NOT EXISTS public.mehfil_listeners (
  mehfil_id text NOT NULL REFERENCES public.mehfils(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mehfil_id, user_id)
);

CREATE INDEX IF NOT EXISTS mehfil_listeners_mehfil_idx ON public.mehfil_listeners (mehfil_id, joined_at DESC);

ALTER TABLE public.mehfil_listeners ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mehfil_listeners' AND policyname = 'mehfil_listeners_read'
  ) THEN
    CREATE POLICY "mehfil_listeners_read" ON public.mehfil_listeners FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mehfil_listeners' AND policyname = 'mehfil_listeners_insert_own'
  ) THEN
    CREATE POLICY "mehfil_listeners_insert_own" ON public.mehfil_listeners
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mehfil_listeners' AND policyname = 'mehfil_listeners_delete_own'
  ) THEN
    CREATE POLICY "mehfil_listeners_delete_own" ON public.mehfil_listeners
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Story media bucket (images + short video)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stories',
  'stories',
  true,
  26214400,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE
  SET public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'stories_public_select'
  ) THEN
    CREATE POLICY "stories_public_select" ON storage.objects FOR SELECT
      USING (bucket_id = 'stories');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'stories_auth_insert'
  ) THEN
    CREATE POLICY "stories_auth_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'stories' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'stories_owner_delete'
  ) THEN
    CREATE POLICY "stories_owner_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'stories' AND owner = auth.uid());
  END IF;
END $$;

-- Editorial masonry defaults (admin_config key-value — safe upsert)
INSERT INTO public.admin_config (key, value, updated_at)
VALUES
  ('feed_hero_interval', '4', now()),
  ('feed_masonry_gap_px', '12', now()),
  ('feed_mehfil_insert_at', '2', now())
ON CONFLICT (key) DO NOTHING;
