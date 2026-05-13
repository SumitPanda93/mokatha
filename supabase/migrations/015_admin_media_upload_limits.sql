-- Tunable media limits (read by app; align Supabase Storage bucket file_size_limit >= these MB values).

INSERT INTO public.admin_config (key, value) VALUES
  ('max_upload_audio_mb', '100'),
  ('max_upload_avatar_mb', '5'),
  ('reel_poster_width_px', '720')
ON CONFLICT (key) DO NOTHING;
