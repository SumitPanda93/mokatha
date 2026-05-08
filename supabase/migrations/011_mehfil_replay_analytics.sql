-- Mehfil replay metadata + lightweight analytics + post source link

-- 1) Posts: optional link back to originating Mehfil (replay & future use)
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS source_mehfil_id text REFERENCES public.mehfils(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS posts_source_mehfil_idx ON public.posts(source_mehfil_id)
WHERE source_mehfil_id IS NOT NULL;

-- 2) Mehfil replay drafts / publish bridge (audio lives in existing Storage)
CREATE TABLE IF NOT EXISTS public.mehfil_replays (
  id             text PRIMARY KEY,
  mehfil_id      text NOT NULL REFERENCES public.mehfils(id) ON DELETE CASCADE,
  host_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_url      text NOT NULL,
  title          text NOT NULL DEFAULT '',
  cover_url      text,
  duration_sec   int,
  post_id        text REFERENCES public.posts(id) ON DELETE SET NULL,
  published      boolean NOT NULL DEFAULT false,
  is_private     boolean NOT NULL DEFAULT false,
  deleted        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mehfil_replays_mehfil_idx ON public.mehfil_replays(mehfil_id);
CREATE INDEX IF NOT EXISTS mehfil_replays_host_idx ON public.mehfil_replays(host_id);

DROP TRIGGER IF EXISTS trg_mehfil_replays_updated_at ON public.mehfil_replays;
CREATE TRIGGER trg_mehfil_replays_updated_at
BEFORE UPDATE ON public.mehfil_replays
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.mehfil_replays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mehfil_replays_select" ON public.mehfil_replays
FOR SELECT USING (
  deleted = false AND (
    host_id = auth.uid()
    OR (
      published = true
      AND post_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = mehfil_replays.post_id
          AND p.hidden = false
          AND (p.is_private = false OR p.author_id = auth.uid())
      )
    )
  )
);

CREATE POLICY "mehfil_replays_insert" ON public.mehfil_replays
FOR INSERT WITH CHECK (
  host_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.mehfils m WHERE m.id = mehfil_id AND m.host_id = auth.uid())
);

CREATE POLICY "mehfil_replays_update" ON public.mehfil_replays
FOR UPDATE USING (host_id = auth.uid());

CREATE POLICY "mehfil_replays_delete" ON public.mehfil_replays
FOR DELETE USING (host_id = auth.uid());

-- 3) Lightweight client analytics (no dashboard; INSERT-only for authenticated users)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          text PRIMARY KEY,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name        text NOT NULL,
  props       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_name_created_idx ON public.analytics_events(name, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_events_insert_own" ON public.analytics_events
FOR INSERT WITH CHECK (user_id = auth.uid());
