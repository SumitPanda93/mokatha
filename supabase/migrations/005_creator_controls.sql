-- ─── Migration 005: Creator controls + withdrawal requests ────────────────────

-- 1. Private posts flag
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 2. Dedicated withdrawal_requests table (balance deducted only on approval)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id             text        PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount         int         NOT NULL CHECK (amount >= 100),
  method         text        NOT NULL CHECK (method IN ('upi', 'bank')),
  account_details text       NOT NULL,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz
);

CREATE INDEX IF NOT EXISTS wr_user_idx   ON public.withdrawal_requests (user_id);
CREATE INDEX IF NOT EXISTS wr_status_idx ON public.withdrawal_requests (status);

-- 3. ink_rewards: add last_earn_date to power per-day deduplication
ALTER TABLE public.ink_rewards
ADD COLUMN IF NOT EXISTS last_earn_date text NOT NULL DEFAULT '';

-- ─── RLS — withdrawal_requests ────────────────────────────────────────────────

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "wr_select_own" ON public.withdrawal_requests
FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own pending requests
CREATE POLICY "wr_insert_own" ON public.withdrawal_requests
FOR INSERT WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Only admins can update (approve / reject)
CREATE POLICY "wr_admin_update" ON public.withdrawal_requests
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Admins can read all requests
CREATE POLICY "wr_admin_select" ON public.withdrawal_requests
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ─── RLS — private posts ──────────────────────────────────────────────────────
-- NOTE: The existing posts_read_all policy (using true) takes precedence.
-- Private-post filtering is handled in the frontend query layer (is_private=false
-- OR author_id=uid) to avoid breaking the admin moderation feed.
-- For a future hardening pass, drop posts_read_all and create a stricter policy.

-- ─── RLS — posts: authors can update / delete their own posts ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'posts' AND policyname = 'posts_author_delete'
  ) THEN
    -- Already covered by posts_admin_delete from migration 004, but guard authors too
    CREATE POLICY "posts_author_delete" ON public.posts
    FOR DELETE USING (author_id = auth.uid());
  END IF;
END $$;
