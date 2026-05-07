-- ─── Storage buckets ──────────────────────────────────────────────────────────
-- Run this migration in the Supabase SQL editor or via supabase db push.
-- Creates two public buckets: `audio` (voice/reel recordings) and `avatars`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'audio',
    'audio',
    true,
    104857600,   -- 100 MB limit
    array[
      'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
      'audio/aac', 'audio/x-m4a',
      'video/webm', 'video/mp4', 'video/ogg'
    ]
  ),
  (
    'avatars',
    'avatars',
    true,
    5242880,     -- 5 MB limit
    array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─── RLS policies — audio bucket ─────────────────────────────────────────────

-- Anyone can read public audio files
create policy "audio_public_select"
on storage.objects for select
using (bucket_id = 'audio');

-- Authenticated users can upload to their own folder
create policy "audio_auth_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'audio' and auth.uid() is not null);

-- Owners can update their own uploads
create policy "audio_owner_update"
on storage.objects for update to authenticated
using (bucket_id = 'audio' and owner = auth.uid());

-- Owners can delete their own uploads
create policy "audio_owner_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'audio' and owner = auth.uid());

-- ─── RLS policies — avatars bucket ───────────────────────────────────────────

-- Anyone can read avatars
create policy "avatars_public_select"
on storage.objects for select
using (bucket_id = 'avatars');

-- Authenticated users can upload avatars
create policy "avatars_auth_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and auth.uid() is not null);

-- Owners can replace their own avatar
create policy "avatars_owner_update"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and owner = auth.uid());

-- Owners can delete their own avatar
create policy "avatars_owner_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and owner = auth.uid());
