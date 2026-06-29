-- Cache — database schema.
-- Paste this into the Supabase SQL editor and run it once.

create table profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamp default now()
);

create table stashes (
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
  -- Regular weekly opening hours captured from Google Places at save time, used
  -- by the native geofence to only notify when a place is open. Shape:
  --   { "periods": [{"open": {"day": 0-6, "time": "HHMM"}, "close": {...}}],
  --     "utc_offset_minutes": <int> }
  opening_hours jsonb,
  -- Google place_id of the chosen address. Lets us dedup ("already saved").
  place_id text,
  visibility text default 'private',
  visited_at timestamp default null,
  created_at timestamp default now()
);

-- Helpful indexes for the queries the app actually runs:
--   - all stashes for a user, newest first (Map + Saved)
--   - unvisited stashes for a user (background proximity check)
create index if not exists stashes_user_created_idx
  on stashes (user_id, created_at desc);

create index if not exists stashes_user_unvisited_idx
  on stashes (user_id)
  where visited_at is null;

-- Phase 2 (friends maps) will query by visibility; index it now so that change
-- is purely additive.
create index if not exists stashes_visibility_idx
  on stashes (visibility);
