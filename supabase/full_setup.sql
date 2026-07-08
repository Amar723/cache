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
  created_at timestamp default now()
);

create table if not exists stashes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  place_name text not null,
  address text,
  lat float not null,
  lng float not null,
  category text,
  notes text,
  tiktok_url text not null,
  thumbnail_url text,
  opening_hours jsonb,
  place_id text,
  visibility text default 'private',
  visited_at timestamp default null,
  created_at timestamp default now()
);

-- Defensive: ensure the Phase 2 column exists on an older stashes table.
alter table stashes add column if not exists visibility text default 'private';

-- Phase 3 (trips): places can be stashed without a video, so the link is
-- optional. Backfill: manual adds used to store ''.
alter table stashes alter column tiktok_url drop not null;
update stashes set tiktok_url = null where tiktok_url = '';

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending', -- 'pending' | 'accepted' | 'declined'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (requester_id <> addressee_id)
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

-- ── Row Level Security: enable ──────────────────────────────────────────────
alter table profiles enable row level security;
alter table stashes enable row level security;
alter table friendships enable row level security;

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

-- ── updated_at trigger for friendships ──────────────────────────────────────
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
  delete from profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function delete_account() from public;
grant execute on function delete_account() to authenticated;
