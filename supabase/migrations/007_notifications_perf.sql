-- ─── Migration 007: Notification performance indexes ─────────────────────────

-- Composite index on (recipient_id, read) speeds up:
--  • unread badge count: WHERE recipient_id = $1 AND read = false
--  • notification list:  WHERE recipient_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS notif_recipient_read_idx
  ON public.notifications (recipient_id, read, created_at DESC);

-- Partial index for unread-only queries (used by the bell badge)
CREATE INDEX IF NOT EXISTS notif_unread_partial_idx
  ON public.notifications (recipient_id)
  WHERE read = false;
