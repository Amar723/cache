-- Cache — Row Level Security.
-- Run after schema.sql. These policies scope every row to its owner.

alter table profiles enable row level security;
alter table stashes enable row level security;

create policy "Users can manage their own profile"
  on profiles for all using (auth.uid() = id);

-- Profiles are discoverable: any signed-in user can read profile rows so friend
-- search by username works. (Only username/display_name/avatar are stored here;
-- nothing private.) The owner-only policy above still governs writes.
create policy "Authenticated users can read profiles"
  on profiles for select using (auth.role() = 'authenticated');

create policy "Users can manage their own stashes"
  on stashes for all using (auth.uid() = user_id);

-- Phase 2 (friends maps) adds a read-only "friends can see each other's visible
-- stashes" policy. It depends on the friendships table, so it lives in
-- supabase/friends.sql (run that after this file).
