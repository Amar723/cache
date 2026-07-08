-- ============================================================================
-- Cache — full backend setup (idempotent).
--
-- One script that sets up / repairs the entire schema: tables, indexes, RLS
-- policies, storage, the friendships graph, itineraries (trips), and the
-- account-deletion RPC. Replaces running schema.sql / rls.sql / storage.sql /
-- friends.sql / itineraries.sql / account.sql separately.
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

create table if not exists itineraries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists itinerary_members (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  -- 'pending' | 'accepted'; declining deletes the row. The owner has NO row
  -- here: ownership is implicit membership.
  status text not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists itinerary_stashes (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  stash_id uuid not null references stashes(id) on delete cascade,
  added_by uuid not null references profiles(id) on delete cascade,
  -- Split date/time (not timestamptz): "date without time" is representable,
  -- and a trip's schedule is destination wall-clock — it must not shift when
  -- viewed from another timezone.
  scheduled_date date,
  scheduled_time time,
  created_at timestamptz default now(),
  check (scheduled_time is null or scheduled_date is not null)
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

-- One membership per person per trip; one entry per stash per trip.
create unique index if not exists itinerary_members_unique_idx
  on itinerary_members (itinerary_id, user_id);
create index if not exists itinerary_members_user_idx
  on itinerary_members (user_id, status);
create unique index if not exists itinerary_stashes_unique_idx
  on itinerary_stashes (itinerary_id, stash_id);
create index if not exists itinerary_stashes_stash_idx
  on itinerary_stashes (stash_id);
create index if not exists itinerary_stashes_trip_date_idx
  on itinerary_stashes (itinerary_id, scheduled_date);

-- ── Membership helpers (SECURITY DEFINER) ───────────────────────────────────
-- Policies on itinerary_members can't query itinerary_members themselves
-- (recursive RLS, error 42P17). These helpers read with RLS bypassed; every
-- membership check in the itinerary policies goes through them.

-- Owner or accepted member: may see the trip's contents.
create or replace function is_itinerary_member(itin uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from itineraries i where i.id = itin and i.owner_id = uid)
      or exists (select 1 from itinerary_members m
                 where m.itinerary_id = itin and m.user_id = uid and m.status = 'accepted');
$$;

-- Owner or any member row (incl. pending): may see the trip's name/members,
-- so an invitee can read what they were invited to before accepting.
create or replace function is_itinerary_participant(itin uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from itineraries i where i.id = itin and i.owner_id = uid)
      or exists (select 1 from itinerary_members m
                 where m.itinerary_id = itin and m.user_id = uid);
$$;

-- Is this stash shared into any trip the user belongs to?
create or replace function stash_in_my_itinerary(stash uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from itinerary_stashes its
    where its.stash_id = stash and is_itinerary_member(its.itinerary_id, uid)
  );
$$;

revoke all on function is_itinerary_member(uuid, uuid) from public;
grant execute on function is_itinerary_member(uuid, uuid) to authenticated;
revoke all on function is_itinerary_participant(uuid, uuid) from public;
grant execute on function is_itinerary_participant(uuid, uuid) to authenticated;
revoke all on function stash_in_my_itinerary(uuid, uuid) from public;
grant execute on function stash_in_my_itinerary(uuid, uuid) to authenticated;

-- ── Row Level Security: enable ──────────────────────────────────────────────
alter table profiles enable row level security;
alter table stashes enable row level security;
alter table friendships enable row level security;
alter table itineraries enable row level security;
alter table itinerary_members enable row level security;
alter table itinerary_stashes enable row level security;

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

-- Adding a stash to a trip IS the consent, so this applies regardless of the
-- stash's `visibility` — including 'private'.
drop policy if exists "Trip members can read stashes shared into a trip" on stashes;
create policy "Trip members can read stashes shared into a trip"
  on stashes for select
  using (stash_in_my_itinerary(id, auth.uid()));

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

-- ── Policies: itineraries ───────────────────────────────────────────────────
drop policy if exists "Participants can read itineraries" on itineraries;
create policy "Participants can read itineraries"
  on itineraries for select
  using (is_itinerary_participant(id, auth.uid()));

drop policy if exists "Users can create their own itineraries" on itineraries;
create policy "Users can create their own itineraries"
  on itineraries for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can update their itineraries" on itineraries;
create policy "Owners can update their itineraries"
  on itineraries for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners can delete their itineraries" on itineraries;
create policy "Owners can delete their itineraries"
  on itineraries for delete
  using (auth.uid() = owner_id);

-- ── Policies: itinerary_members ─────────────────────────────────────────────
drop policy if exists "Participants can read the member list" on itinerary_members;
create policy "Participants can read the member list"
  on itinerary_members for select
  using (user_id = auth.uid() or is_itinerary_participant(itinerary_id, auth.uid()));

drop policy if exists "Owners can invite accepted friends" on itinerary_members;
create policy "Owners can invite accepted friends"
  on itinerary_members for insert
  with check (
    status = 'pending'
    and exists (select 1 from itineraries i
                where i.id = itinerary_id and i.owner_id = auth.uid())
    and exists (select 1 from friendships f
                where f.status = 'accepted'
                  and ((f.requester_id = auth.uid() and f.addressee_id = user_id)
                    or (f.addressee_id = auth.uid() and f.requester_id = user_id)))
  );

drop policy if exists "Invitees can update their own membership" on itinerary_members;
create policy "Invitees can update their own membership"
  on itinerary_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Members leave or owners remove" on itinerary_members;
create policy "Members leave or owners remove"
  on itinerary_members for delete
  using (user_id = auth.uid()
      or exists (select 1 from itineraries i
                 where i.id = itinerary_id and i.owner_id = auth.uid()));

-- ── Policies: itinerary_stashes ─────────────────────────────────────────────
-- Accepted members only (a pending invitee sees the trip's name and members,
-- not its places — consent cuts both ways).
drop policy if exists "Members can read trip entries" on itinerary_stashes;
create policy "Members can read trip entries"
  on itinerary_stashes for select
  using (is_itinerary_member(itinerary_id, auth.uid()));

drop policy if exists "Members can add their own stashes" on itinerary_stashes;
create policy "Members can add their own stashes"
  on itinerary_stashes for insert
  with check (
    added_by = auth.uid()
    and is_itinerary_member(itinerary_id, auth.uid())
    and exists (select 1 from stashes s where s.id = stash_id and s.user_id = auth.uid())
  );

-- Any member can edit any entry's schedule.
drop policy if exists "Members can update trip entries" on itinerary_stashes;
create policy "Members can update trip entries"
  on itinerary_stashes for update
  using (is_itinerary_member(itinerary_id, auth.uid()))
  with check (is_itinerary_member(itinerary_id, auth.uid()));

drop policy if exists "Adders remove their entries, owners remove any" on itinerary_stashes;
create policy "Adders remove their entries, owners remove any"
  on itinerary_stashes for delete
  using (added_by = auth.uid()
      or exists (select 1 from itineraries i
                 where i.id = itinerary_id and i.owner_id = auth.uid()));

-- Updates may only touch the columns the app edits: an invitee accepts by
-- flipping status, a member reschedules an entry. Without this, the UPDATE
-- policies above would let a row be repointed at another trip or stash.
revoke update on itinerary_members from authenticated;
grant update (status) on itinerary_members to authenticated;
revoke update on itinerary_stashes from authenticated;
grant update (scheduled_date, scheduled_time) on itinerary_stashes to authenticated;

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

drop trigger if exists itineraries_updated_at on itineraries;
create trigger itineraries_updated_at
  before update on itineraries
  for each row execute function set_updated_at();

drop trigger if exists itinerary_members_updated_at on itinerary_members;
create trigger itinerary_members_updated_at
  before update on itinerary_members
  for each row execute function set_updated_at();

-- Leaving (or being removed from) a trip revokes the consent that member's
-- additions granted, so their entries go with them. DB-side so it's atomic.
create or replace function remove_member_entries()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from itinerary_stashes
   where itinerary_id = old.itinerary_id and added_by = old.user_id;
  return old;
end;
$$;

drop trigger if exists itinerary_members_cleanup on itinerary_members;
create trigger itinerary_members_cleanup
  after delete on itinerary_members
  for each row execute function remove_member_entries();

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

  -- Trips they own cascade to members + entries; leaving other trips triggers
  -- removal of their entries there; deleting stashes cascades any leftovers.
  delete from itineraries where owner_id = uid;
  delete from itinerary_members where user_id = uid;
  delete from stashes where user_id = uid;
  delete from friendships where requester_id = uid or addressee_id = uid;
  delete from profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function delete_account() from public;
grant execute on function delete_account() to authenticated;
