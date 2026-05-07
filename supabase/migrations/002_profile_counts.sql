-- Mo Katha: add denormalized follower/following counts + suspended flag to profiles
-- Run after 001_init.sql

alter table public.profiles add column if not exists followers int not null default 0;
alter table public.profiles add column if not exists following int not null default 0;
alter table public.profiles add column if not exists suspended boolean not null default false;

-- Allow admins to update any profile (needed for suspend/verify operations)
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());
