-- Max reel clip length (seconds) for trim / publish — create reel UI enforces this.

INSERT INTO public.admin_config (key, value) VALUES
  ('reel_max_duration_sec', '120')
ON CONFLICT (key) DO NOTHING;
