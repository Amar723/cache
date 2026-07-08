# Security guidelines

- Keep secrets out of git: `.env`, API keys, tokens, keystores, signing files, and Supabase service-role values.
- Treat location, saved places, friend relationships, itineraries, avatars, and auth state as private user data.
- Validate shared URLs, deep links, usernames, profile input, place details, coordinates, and edge-function request params before use.
- Preserve Supabase RLS and ownership filters. Frontend checks are never the only security boundary.
- Keep stash visibility rules intact: private is owner-only; friends/public access must match current RLS and UI intent.
- Do not log tokens, private user data, precise coordinates, sensitive place history, or raw external payloads containing user data.
- Use user-safe error messages. Do not silently swallow errors that affect saved data, auth, location permissions, notifications, or sharing.
