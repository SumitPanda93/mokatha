-- 009_creator_economy.sql
-- Admin config, emotional support actions, mehfil queue, audio letters
-- Phase 1 Creator Economy — Mo Katha

-- ─── 1. Admin-configurable limits ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_config (
  key        text PRIMARY KEY,
  value      text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_config_read"   ON admin_config FOR SELECT USING (true);
CREATE POLICY "admin_config_write"  ON admin_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

INSERT INTO admin_config (key, value) VALUES
  ('max_support_amount',    '5'),
  ('daily_support_limit',   '25'),
  ('max_withdrawal_limit',  '500'),
  ('reader_rewards_enabled','true'),
  ('mehfil_ticket_cap',     '5')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. Emotional support actions ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_actions (
  id           text PRIMARY KEY,
  from_user_id uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id   uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id      text          REFERENCES posts(id)    ON DELETE SET NULL,
  mehfil_id    text          REFERENCES mehfils(id)  ON DELETE SET NULL,
  action_type  text          NOT NULL,   -- chai | rose | applaud | support | ticket
  amount       numeric(10,2) NOT NULL DEFAULT 1,
  created_at   timestamptz   DEFAULT now()
);

ALTER TABLE support_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_read"   ON support_actions FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "support_insert" ON support_actions FOR INSERT
  WITH CHECK (from_user_id = auth.uid());

-- ─── 3. Mehfil enhancements (ticketing + speaker cap) ────────────────────────

ALTER TABLE mehfils
  ADD COLUMN IF NOT EXISTS is_ticketed  boolean        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ticket_price numeric(10,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_speakers integer        NOT NULL DEFAULT 3;

-- ─── 4. Speaker queue ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mehfil_queue (
  id           text PRIMARY KEY,
  mehfil_id    text NOT NULL REFERENCES mehfils(id)  ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending',  -- pending | speaking | done | rejected
  requested_at timestamptz DEFAULT now()
);

ALTER TABLE mehfil_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_read"        ON mehfil_queue FOR SELECT USING (true);
CREATE POLICY "queue_insert_own"  ON mehfil_queue FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "queue_update"      ON mehfil_queue FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM mehfils m WHERE m.id = mehfil_id AND m.host_id = auth.uid())
  );
CREATE POLICY "queue_delete"      ON mehfil_queue FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM mehfils m WHERE m.id = mehfil_id AND m.host_id = auth.uid())
  );

-- ─── 5. Audio letters (private voice appreciation) ───────────────────────────

CREATE TABLE IF NOT EXISTS audio_letters (
  id           text PRIMARY KEY,
  from_user_id uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id   uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  audio_url    text    NOT NULL,
  duration_sec integer DEFAULT 0,
  body         text,
  read         boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE audio_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "letters_read"   ON audio_letters FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "letters_insert" ON audio_letters FOR INSERT
  WITH CHECK (from_user_id = auth.uid());
CREATE POLICY "letters_update" ON audio_letters FOR UPDATE
  USING (to_user_id = auth.uid());
