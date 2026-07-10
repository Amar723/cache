-- Cache — remote push notifications: device tokens + overlap notification dedupe.
-- Run after schema.sql and friends.sql, once, in the Supabase SQL editor.
-- (friends.sql already defines set_updated_at(), reused below.)

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  platform text not null, -- 'ios' | 'android'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, token)
);

create index push_tokens_user_idx on push_tokens (user_id);

alter table push_tokens enable row level security;

-- A user manages only their own device tokens. Deliberately no policy lets
-- one user read another's token — the notify-overlap edge function reads
-- across users with the service-role key, which bypasses RLS entirely.
create policy "Manage own push tokens"
  on push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger push_tokens_updated_at
  before update on push_tokens
  for each row execute function set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- Dedupe log: one push per matched pair of stashes, no matter how many times
-- either stash is re-saved/edited afterward.
create table overlap_notifications (
  id uuid primary key default gen_random_uuid(),
  stash_id_a uuid not null references stashes(id) on delete cascade,
  stash_id_b uuid not null references stashes(id) on delete cascade,
  notified_at timestamptz default now(),
  check (stash_id_a <> stash_id_b)
);

-- One notification per unordered pair of stashes.
create unique index overlap_notifications_pair_idx
  on overlap_notifications (least(stash_id_a, stash_id_b), greatest(stash_id_a, stash_id_b));

-- No policies at all: only the notify-overlap edge function (service-role
-- key, bypasses RLS) ever touches this table. It's server bookkeeping, not
-- user-facing data.
alter table overlap_notifications enable row level security;
