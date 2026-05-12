-- Vertical reel video (distinct from optional legacy reel audio overlay)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN public.posts.video_url IS 'Public URL for vertical reel video (MP4/WebM); primary reel media when set';
