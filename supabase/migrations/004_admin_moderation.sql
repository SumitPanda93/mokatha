-- ─── Admin moderation columns on posts ────────────────────────────────────────

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS hidden          boolean      NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS moderated_at   timestamptz,
ADD COLUMN IF NOT EXISTS moderated_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index speeds up the admin "show hidden posts" query
CREATE INDEX IF NOT EXISTS posts_hidden_idx ON public.posts (hidden);

-- ─── Admin RLS: full read on posts (including hidden) ─────────────────────────
-- Regular users already have posts_read_all which allows select true.
-- Admins need to be able to read hidden posts too — the frontend handles
-- filtering by hidden=false for the public feed via query params.
-- No additional SELECT policy needed; existing open policy covers admin reads.

-- ─── Admin RLS: update any post (hide / unhide / moderate) ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'posts' AND policyname = 'posts_admin_update'
  ) THEN
    CREATE POLICY "posts_admin_update" ON public.posts
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ─── Admin RLS: delete any post (reject / remove) ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'posts' AND policyname = 'posts_admin_delete'
  ) THEN
    CREATE POLICY "posts_admin_delete" ON public.posts
    FOR DELETE USING (
      author_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ─── Admin logs: allow any authenticated user to insert (self-log) ────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_logs' AND policyname = 'admin_logs_insert_auth'
  ) THEN
    CREATE POLICY "admin_logs_insert_auth" ON public.admin_logs
    FOR INSERT WITH CHECK (actor_id = auth.uid());
  END IF;
END $$;

-- ─── Admin logs: only admins can read ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_logs' AND policyname = 'admin_logs_read_admin'
  ) THEN
    CREATE POLICY "admin_logs_read_admin" ON public.admin_logs
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ─── Admin reports: only admins can update report status ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reports' AND policyname = 'reports_admin_update'
  ) THEN
    CREATE POLICY "reports_admin_update" ON public.reports
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ─── Set is_admin on the admin account ───────────────────────────────────────
-- Replace 'admin@mokatha.in' with your actual admin email if different.
-- This only runs if the profile row exists already.
UPDATE public.profiles
SET is_admin = true
WHERE email = 'admin@mokatha.in' AND is_admin IS DISTINCT FROM true;
