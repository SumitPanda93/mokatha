-- Mo Katha: initial schema + RLS (Supabase)
-- Apply in Supabase SQL editor or via supabase CLI migrations.

-- Enable extensions
create extension if not exists pgcrypto;

-- Profiles: 1:1 with auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  handle text unique,
  display_name text,
  avatar_url text,
  bio text default '',
  language text default 'or' check (language in ('or','hi')),
  verified boolean default false,
  is_admin boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Posts
create table if not exists public.posts (
  id text primary key,
  kind text not null check (kind in ('voice','text','story','reel')),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  audio_url text,
  cover_url text,
  duration_sec int,
  language text default 'or' check (language in ('or','hi')),
  created_at timestamptz not null default now(),
  likes int not null default 0,
  comments int not null default 0,
  tips_total int not null default 0,
  tags text[] not null default '{}'::text[],
  access_type text default 'free' check (access_type in ('free','tip','premium')),
  min_tip int
);

create table if not exists public.comments (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  likes int not null default 0
);

create table if not exists public.post_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id text not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id text not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);

-- Wallet + transactions
create table if not exists public.wallet_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance int not null default 0
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('earning','withdraw','tip-sent','tip-received')),
  amount int not null,
  status text not null check (status in ('pending','completed','failed')),
  created_at timestamptz not null default now(),
  counterparty_id uuid references public.profiles(id),
  note text
);

-- Mehfil
create table if not exists public.mehfils (
  id text primary key,
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  is_live boolean not null default false,
  listeners int not null default 0,
  starts_at timestamptz not null default now(),
  cover_url text,
  language text default 'or' check (language in ('or','hi')),
  tags text[] not null default '{}'::text[]
);

-- Notifications
create table if not exists public.notifications (
  id text primary key,
  kind text not null,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  target_id text not null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

-- Admin logs + reports
create table if not exists public.reports (
  id text primary key,
  kind text not null check (kind in ('post','user','mehfil')),
  target_id text not null,
  reason text not null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
  id text primary key,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);

-- Author plans + subscriptions
create table if not exists public.author_plans (
  author_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  price_monthly int not null default 99,
  benefits text[] not null default '{}'::text[]
);

create table if not exists public.subscriptions (
  id text primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date timestamptz not null default now(),
  expiry_date timestamptz not null,
  status text not null default 'active' check (status in ('active','expired','cancelled'))
);

-- Conversations + messages
create table if not exists public.conversations (
  id text primary key,
  participant_ids uuid[] not null,
  last_message_at timestamptz not null default now()
);

create table if not exists public.messages (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Ink rewards
create table if not exists public.ink_rewards (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  points int not null default 0,
  streak_days int not null default 0,
  last_claim_date text not null default '',
  badges text[] not null default '{}'::text[],
  unlocked_post_ids text[] not null default '{}'::text[]
);

-- -----------------------
-- RLS
-- -----------------------
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.saved_posts enable row level security;
alter table public.follows enable row level security;
alter table public.wallet_balances enable row level security;
alter table public.transactions enable row level security;
alter table public.mehfils enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.admin_logs enable row level security;
alter table public.author_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.ink_rewards enable row level security;

-- Helper: auth uid
create or replace function public.uid()
returns uuid language sql stable as $$
  select auth.uid()
$$;

-- Profiles policies
drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all" on public.profiles for select using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert with check (id = public.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update using (id = public.uid()) with check (id = public.uid());

-- Posts: public read, only author write
drop policy if exists "posts_read_all" on public.posts;
create policy "posts_read_all" on public.posts for select using (true);

drop policy if exists "posts_insert_author" on public.posts;
create policy "posts_insert_author" on public.posts for insert with check (author_id = public.uid());

drop policy if exists "posts_update_author" on public.posts;
create policy "posts_update_author" on public.posts for update using (author_id = public.uid()) with check (author_id = public.uid());

drop policy if exists "posts_delete_author" on public.posts;
create policy "posts_delete_author" on public.posts for delete using (author_id = public.uid());

-- Comments: read all, author write
drop policy if exists "comments_read_all" on public.comments;
create policy "comments_read_all" on public.comments for select using (true);
drop policy if exists "comments_insert_author" on public.comments;
create policy "comments_insert_author" on public.comments for insert with check (author_id = public.uid());
drop policy if exists "comments_update_author" on public.comments;
create policy "comments_update_author" on public.comments for update using (author_id = public.uid()) with check (author_id = public.uid());
drop policy if exists "comments_delete_author" on public.comments;
create policy "comments_delete_author" on public.comments for delete using (author_id = public.uid());

-- Likes/saves/follows: only self
drop policy if exists "post_likes_self" on public.post_likes;
create policy "post_likes_self" on public.post_likes
for all using (user_id = public.uid()) with check (user_id = public.uid());

drop policy if exists "saved_posts_self" on public.saved_posts;
create policy "saved_posts_self" on public.saved_posts
for all using (user_id = public.uid()) with check (user_id = public.uid());

drop policy if exists "follows_self" on public.follows;
create policy "follows_self" on public.follows
for all using (follower_id = public.uid()) with check (follower_id = public.uid());

-- Wallet: only self
drop policy if exists "wallet_self" on public.wallet_balances;
create policy "wallet_self" on public.wallet_balances
for all using (user_id = public.uid()) with check (user_id = public.uid());

drop policy if exists "txs_self" on public.transactions;
create policy "txs_self" on public.transactions
for select using (user_id = public.uid());

create policy "txs_insert_self" on public.transactions
for insert with check (user_id = public.uid());

-- Mehfils: read all, host write
drop policy if exists "mehfils_read_all" on public.mehfils;
create policy "mehfils_read_all" on public.mehfils for select using (true);
drop policy if exists "mehfils_write_host" on public.mehfils;
create policy "mehfils_write_host" on public.mehfils
for all using (host_id = public.uid()) with check (host_id = public.uid());

-- Notifications: only recipient
drop policy if exists "notifs_self" on public.notifications;
create policy "notifs_self" on public.notifications
for select using (recipient_id = public.uid());
create policy "notifs_insert_self_actor" on public.notifications
for insert with check (actor_id = public.uid());
create policy "notifs_update_recipient" on public.notifications
for update using (recipient_id = public.uid()) with check (recipient_id = public.uid());

-- Reports: reporter can create/read own; admins can read all
drop policy if exists "reports_read_own" on public.reports;
create policy "reports_read_own" on public.reports
for select using (reporter_id = public.uid());
create policy "reports_insert_own" on public.reports
for insert with check (reporter_id = public.uid());

-- Admin tables: only admins
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists(select 1 from public.profiles p where p.id = public.uid() and p.is_admin = true)
$$;

drop policy if exists "admin_logs_admin_only" on public.admin_logs;
create policy "admin_logs_admin_only" on public.admin_logs
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reports_admin_read" on public.reports;
create policy "reports_admin_read" on public.reports
for select using (public.is_admin());

-- Plans/subscriptions: read all plans; subscription rows only self
drop policy if exists "plans_read_all" on public.author_plans;
create policy "plans_read_all" on public.author_plans for select using (true);
create policy "plans_write_author" on public.author_plans
for all using (author_id = public.uid()) with check (author_id = public.uid());

drop policy if exists "subs_read_self" on public.subscriptions;
create policy "subs_read_self" on public.subscriptions
for select using (user_id = public.uid() or author_id = public.uid());
create policy "subs_insert_self" on public.subscriptions
for insert with check (user_id = public.uid());
create policy "subs_update_self" on public.subscriptions
for update using (user_id = public.uid()) with check (user_id = public.uid());

-- Conversations/messages: participants only
drop policy if exists "conversations_participants" on public.conversations;
create policy "conversations_participants" on public.conversations
for select using (public.uid() = any(participant_ids));
create policy "conversations_insert_participants" on public.conversations
for insert with check (public.uid() = any(participant_ids));

drop policy if exists "messages_participants" on public.messages;
create policy "messages_participants" on public.messages
for select using (exists(select 1 from public.conversations c where c.id = conversation_id and public.uid() = any(c.participant_ids)));
create policy "messages_insert_sender" on public.messages
for insert with check (sender_id = public.uid());

-- Ink rewards: self only
drop policy if exists "ink_self" on public.ink_rewards;
create policy "ink_self" on public.ink_rewards
for all using (user_id = public.uid()) with check (user_id = public.uid());

