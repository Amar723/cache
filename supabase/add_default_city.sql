-- Migration: give each user a default city.
--
-- Adds `default_city` (display label) plus `default_city_lat` / `default_city_lng`
-- (coordinates) to profiles, so a friend's map can center on their home city
-- without any runtime geocoding. Then backfills existing users to Melbourne.
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run (idempotent).

alter table profiles add column if not exists default_city text;
alter table profiles add column if not exists default_city_lat float;
alter table profiles add column if not exists default_city_lng float;

-- Backfill existing users to Melbourne CBD. New users choose their own city at
-- onboarding, so only pre-existing null rows are touched.
update profiles
set default_city = 'Melbourne, Victoria, Australia',
    default_city_lat = -37.8136,
    default_city_lng = 144.9631
where default_city is null;
