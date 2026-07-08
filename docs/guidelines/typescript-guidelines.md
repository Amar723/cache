# TypeScript guidelines

- Keep `strict` and `noImplicitAny` assumptions intact.
- Do not use `any` unless a nearby comment documents why a safer type is not practical.
- Prefer existing app types from `src/types.ts`, Supabase types, and local function return types before adding new types.
- Validate unknown external data before narrowing it.
- Keep null and loading states explicit for auth, location, network, and Supabase calls.
- Avoid broad type assertions. Use small parsing or guard functions when data crosses a trust boundary.
- Do not change shared types for one screen without checking the callers that use them.
