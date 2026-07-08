-- Cache — account deletion.
-- Run after schema.sql / rls.sql / friends.sql / itineraries.sql, once, in the
-- SQL editor.
--
-- A client can't delete its own auth.users row (that needs elevated rights), so
-- we expose a SECURITY DEFINER function that wipes the caller's data and account
-- atomically. It runs as the function owner (postgres), which can touch
-- auth.users; `auth.uid()` still scopes every delete to the caller.

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

  -- Delete owned data first (no ON DELETE CASCADE from stashes/profiles).
  -- Trips they own cascade to members + entries; leaving other trips triggers
  -- removal of their entries there; deleting stashes cascades any leftovers.
  delete from itineraries where owner_id = uid;
  delete from itinerary_members where user_id = uid;
  delete from stashes where user_id = uid;
  delete from friendships where requester_id = uid or addressee_id = uid;
  delete from profiles where id = uid;

  -- Finally the auth user itself.
  delete from auth.users where id = uid;
end;
$$;

-- Only signed-in users may call it (and it only ever deletes the caller).
revoke all on function delete_account() from public;
grant execute on function delete_account() to authenticated;
