-- ============================================================================
-- Cache — full backend setup (idempotent).
--
-- One script that sets up / repairs the entire schema: tables, indexes, RLS
-- policies, storage, the friendships graph, and the account-deletion RPC.
-- Replaces running schema.sql / rls.sql / storage.sql / friends.sql /
-- account.sql separately.
--
-- SAFE TO RE-RUN on an existing database:
--   - tables/columns use IF NOT EXISTS  → never drops or clobbers your data
--   - every policy/trigger is DROP-then-CREATE → no "already exists" errors
-- It deliberately does NOT drop any table (that would delete rows).
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  -- The user's home city, chosen at onboarding. Label + coordinates so a
  -- friend's map can center on their city without any runtime geocoding.
  default_city text,
  default_city_lat float,
  default_city_lng float,
  created_at timestamptz default now()
);

-- Defensive: ensure the default-city columns exist on an older profiles table.
alter table profiles add column if not exists default_city text;
alter table profiles add column if not exists default_city_lat float;
alter table profiles add column if not exists default_city_lng float;

-- Migrate `created_at` from `timestamp` (no zone) to `timestamptz` so the API
-- serializes a `Z`/offset and clients don't drift by the device's UTC offset.
-- Existing zoneless values are on the session zone (UTC), so no USING clause is
-- needed. Idempotent: a no-op once the column is already timestamptz.
alter table profiles alter column created_at type timestamptz;

create table if not exists stashes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  place_name text not null,
  address text,
  lat float not null,
  lng float not null,
  category text,
  notes text,
  -- Source video link (TikTok or Instagram). Nullable: a place can be saved
  -- without a link.
  video_url text,
  thumbnail_url text,
  opening_hours jsonb,
  place_id text,
  visibility text default 'private',
  visited_at timestamptz default null,
  created_at timestamptz default now()
);

-- Defensive: ensure the Phase 2 column exists on an older stashes table.
alter table stashes add column if not exists visibility text default 'private';

-- Migrate the timestamp columns from `timestamp` (no zone) to `timestamptz` so
-- the API serializes a `Z`/offset and the "cached X ago" tag doesn't drift by
-- the device's UTC offset. Existing zoneless values are on the session zone
-- (UTC), so no USING clause is needed. Idempotent once already timestamptz.
alter table stashes alter column created_at type timestamptz;
alter table stashes alter column visited_at type timestamptz;

-- Migrate the legacy `tiktok_url` column to the platform-agnostic `video_url`
-- (it always held TikTok *or* Instagram links). Idempotent: only renames when
-- the old column is still present, so re-running on a migrated or fresh table
-- is a no-op.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'stashes' and column_name = 'tiktok_url'
  ) then
    alter table stashes rename column tiktok_url to video_url;
  end if;
end $$;

-- Allow places saved without a link to have no video. `drop not null` is
-- idempotent, so this is safe on a fresh table (already nullable) too.
alter table stashes alter column video_url drop not null;

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending', -- 'pending' | 'accepted' | 'declined'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (requester_id <> addressee_id)
);

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  platform text not null, -- 'ios' | 'android'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, token)
);

create table if not exists overlap_notifications (
  id uuid primary key default gen_random_uuid(),
  stash_id_a uuid not null references stashes(id) on delete cascade,
  stash_id_b uuid not null references stashes(id) on delete cascade,
  notified_at timestamptz default now(),
  check (stash_id_a <> stash_id_b)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists stashes_user_created_idx
  on stashes (user_id, created_at desc);
create index if not exists stashes_user_unvisited_idx
  on stashes (user_id) where visited_at is null;
create index if not exists stashes_visibility_idx
  on stashes (visibility);

-- One relationship per pair (A→B and B→A can't both exist).
create unique index if not exists friendships_pair_idx
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on friendships (addressee_id, status);
create index if not exists friendships_requester_idx on friendships (requester_id, status);

create index if not exists push_tokens_user_idx on push_tokens (user_id);

-- One notification per unordered pair of stashes.
create unique index if not exists overlap_notifications_pair_idx
  on overlap_notifications (least(stash_id_a, stash_id_b), greatest(stash_id_a, stash_id_b));

-- ── Row Level Security: enable ──────────────────────────────────────────────
alter table profiles enable row level security;
alter table stashes enable row level security;
alter table friendships enable row level security;
alter table push_tokens enable row level security;
alter table overlap_notifications enable row level security;

-- ── Policies: profiles ──────────────────────────────────────────────────────
drop policy if exists "Users can manage their own profile" on profiles;
create policy "Users can manage their own profile"
  on profiles for all using (auth.uid() = id);

-- Discoverable so friend search by username works (nothing private is stored).
drop policy if exists "Authenticated users can read profiles" on profiles;
create policy "Authenticated users can read profiles"
  on profiles for select using (auth.role() = 'authenticated');

-- ── Policies: stashes ───────────────────────────────────────────────────────
drop policy if exists "Users can manage their own stashes" on stashes;
create policy "Users can manage their own stashes"
  on stashes for all using (auth.uid() = user_id);

-- Accepted friends can read each other's non-private pins (OR'd with the owner
-- policy above, so owners keep full access).
drop policy if exists "Friends can read friends' visible stashes" on stashes;
create policy "Friends can read friends' visible stashes"
  on stashes for select using (
    visibility in ('friends', 'public')
    and exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = stashes.user_id) or
          (f.addressee_id = auth.uid() and f.requester_id = stashes.user_id)
        )
    )
  );

-- ── Policies: friendships ───────────────────────────────────────────────────
drop policy if exists "Read own friendships" on friendships;
create policy "Read own friendships"
  on friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Send friend requests" on friendships;
create policy "Send friend requests"
  on friendships for insert
  with check (auth.uid() = requester_id);

drop policy if exists "Update own friendships" on friendships;
create policy "Update own friendships"
  on friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Delete own friendships" on friendships;
create policy "Delete own friendships"
  on friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ── Policies: push_tokens ───────────────────────────────────────────────────
-- A user manages only their own device tokens. Deliberately no policy lets
-- one user read another's token — the notify-overlap edge function reads
-- across users with the service-role key, which bypasses RLS entirely.
drop policy if exists "Manage own push tokens" on push_tokens;
create policy "Manage own push tokens"
  on push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- overlap_notifications has RLS enabled but intentionally zero policies: only
-- the notify-overlap edge function (service-role key, bypasses RLS) ever
-- touches it. It's server bookkeeping, not user-facing data.

-- ── updated_at trigger for friendships / push_tokens ────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists friendships_updated_at on friendships;
create trigger friendships_updated_at
  before update on friendships
  for each row execute function set_updated_at();

drop trigger if exists push_tokens_updated_at on push_tokens;
create trigger push_tokens_updated_at
  before update on push_tokens
  for each row execute function set_updated_at();

-- ── Storage: public-read avatars bucket, owner-only writes ──────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Account deletion RPC (SECURITY DEFINER: wipes the caller's data + auth user)
create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from stashes where user_id = uid;
  delete from friendships where requester_id = uid or addressee_id = uid;
  delete from push_tokens where user_id = uid;
  delete from profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function delete_account() from public;
grant execute on function delete_account() to authenticated;
