-- Session end time for discovery visibility (24h window after end)
ALTER TABLE mehfils ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Past sessions without ended_at: treat as already ended for feed filtering
UPDATE mehfils
SET ended_at = COALESCE(starts_at::timestamptz, NOW())
WHERE is_live = false AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS mehfils_host_starts_idx ON mehfils (host_id, starts_at DESC);
