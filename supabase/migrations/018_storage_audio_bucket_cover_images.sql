-- Story / voice post covers are uploaded to `audio` bucket under covers/
-- (see uploadPostCoverImage). Bucket MIME allowlist must include raster images.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
  'audio/aac', 'audio/x-m4a',
  'video/webm', 'video/mp4', 'video/ogg',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
]::text[]
WHERE id = 'audio';
