-- Cache — Phase 3 (trips): itineraries shared between friends.
-- Run after friends.sql in the Supabase SQL editor. Safe to re-run.
--
-- An itinerary ("trip") is a named collection of stashes shared between an
-- owner and invited friends. Entries reference real stashes (never copies) and
-- carry an optional destination-local date/time. Adding a stash to a trip is
-- consent for the trip's members to see it, regardless of its `visibility`.

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
  -- 'pending'  — invited by the owner, awaiting acceptance
  -- 'accepted' — full member
  -- Declining an invite deletes the row (the owner may re-invite later).
  -- The owner has NO row here: ownership is implicit membership.
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
-- membership check in the policies below goes through them.

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

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table itineraries enable row level security;
alter table itinerary_members enable row level security;
alter table itinerary_stashes enable row level security;

-- itineraries: participants (incl. pending invitees) can read; owner manages.
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

-- itinerary_members: owner invites accepted friends; invitee accepts their own
-- row; invitee leaves or owner removes.
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

-- itinerary_stashes: accepted members only (a pending invitee sees the trip's
-- name and members, not its places — consent cuts both ways).
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

-- ── Trip members can read stashes shared into a trip ────────────────────────
-- Additional permissive SELECT policy on stashes (OR'd with the owner and
-- friend policies): adding a stash to a trip IS the consent, so this applies
-- regardless of the stash's `visibility` — including 'private'.
drop policy if exists "Trip members can read stashes shared into a trip" on stashes;
create policy "Trip members can read stashes shared into a trip"
  on stashes for select
  using (stash_in_my_itinerary(id, auth.uid()));

-- ── Triggers ────────────────────────────────────────────────────────────────
-- Keep updated_at honest (set_updated_at() is created in friends.sql).
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

-- ── Stashes without a video ─────────────────────────────────────────────────
-- Trips let you add a place directly (no TikTok/Reel), so the link becomes
-- optional. Backfill: manual adds used to store ''.
alter table stashes alter column tiktok_url drop not null;
update stashes set tiktok_url = null where tiktok_url = '';
