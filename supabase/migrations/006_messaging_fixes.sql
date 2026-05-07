-- ─── Migration 006: Messaging fixes ──────────────────────────────────────────

-- Allow conversation participants to update last_message_at when sending a message.
-- Without this, the conversations list won't re-order after new messages are sent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'conversations_update_participants'
  ) THEN
    CREATE POLICY "conversations_update_participants" ON public.conversations
    FOR UPDATE USING (auth.uid() = ANY(participant_ids))
    WITH CHECK (auth.uid() = ANY(participant_ids));
  END IF;
END $$;
