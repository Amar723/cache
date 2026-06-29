-- Cache — Phase 2 (friends maps): friendships graph.
-- Run after schema.sql and rls.sql, once, in the Supabase SQL editor.

create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  -- 'pending'  — requester has asked, awaiting the addressee
  -- 'accepted' — both are friends (symmetric)
  -- 'declined' — addressee said no (kept so we don't re-prompt endlessly)
  status text not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (requester_id <> addressee_id)
);

-- One relationship per pair of people, regardless of who sent the request, so
-- A→B and B→A can't both exist.
create unique index friendships_pair_idx
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- The two lookups the app runs: "my incoming requests" and "my outgoing".
create index friendships_addressee_idx on friendships (addressee_id, status);
create index friendships_requester_idx on friendships (requester_id, status);

-- ───────────────────────────────────────────────────────────────────────────
-- Row Level Security.
alter table friendships enable row level security;

-- See only relationships you're part of.
create policy "Read own friendships"
  on friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- You can only create a request as yourself.
create policy "Send friend requests"
  on friendships for insert
  with check (auth.uid() = requester_id);

-- Either side can change the row: the addressee accepts/declines, either side
-- can revert/cancel. (The app restricts which transitions it offers.)
create policy "Update own friendships"
  on friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Either side can remove the relationship (unfriend / cancel a request).
create policy "Delete own friendships"
  on friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Keep updated_at honest.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger friendships_updated_at
  before update on friendships
  for each row execute function set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- Now that friendships exists, let accepted friends read each other's
-- non-private pins. This is an additional permissive SELECT policy on stashes;
-- RLS OR's it with the owner policy in rls.sql, so owners keep full access.
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
