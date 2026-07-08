# AGENTS.md

## Project overview

Cache is a React Native 0.74 bare TypeScript app for saving places from shared TikTok/Reel links onto a personal map.

- App source: `src/`, `App.tsx`, `index.js`.
- Native projects: `ios/`, `android/`, with setup notes in `README.md` and `native/`.
- Backend: Supabase auth, Postgres, storage, RLS SQL, and edge functions in `supabase/`.
- Sensitive domains: auth/session state, stash ownership, friends visibility, itinerary sharing, location data, notification/deep-link flows, and external URL/place parsing.

## Dev/build/test commands

Use npm; `package-lock.json` is present. Do not switch package managers.

- Install deps: `npm install`.
- Start Metro: `npm start`.
- Run iOS: `npm run ios`.
- Run Android: `npm run android`.
- Install iOS pods after native dependency changes: `npm run pods`.
- Typecheck: `npm run tsc`.
- Lint: `npm run lint`.
- Tests: `npm test`.

Run the narrowest relevant check first. Use full `npm run tsc`, `npm run lint`, and `npm test` before completion when the change touches shared app behaviour or when confidence requires it.

## Agent efficiency rules

AI agent credits are limited. Agents must optimise for small, targeted changes.

Before editing:

- Read the user request.
- Inspect only the files needed for the task.
- Identify the existing pattern before writing new code.
- Make a short plan only when the task is non-trivial.

During implementation:

- Make the smallest safe change.
- Do not refactor unrelated code.
- Do not rename files, move folders, or reformat unrelated files unless asked.
- Do not create new abstractions unless the current code clearly needs them.
- Do not add new dependencies unless the existing stack cannot reasonably solve the problem.
- Do not generate large docs or comments unless requested.
- Do not run broad searches repeatedly.
- Do not run expensive commands repeatedly.

Testing:

- Run targeted tests/checks first.
- Run full checks only when needed for confidence or before marking a task complete.
- If a full check is expensive or unavailable, say what was run and what was not run.

Communication:

- Keep plans short.
- Keep final summaries short and factual.
- Report only:
  - what changed
  - files changed
  - checks run
  - risks or follow-up work
- Do not produce long essays unless asked.

## Code style rules

- Follow existing React Native, hook, store, Supabase, and navigation patterns before adding a new pattern.
- Keep TypeScript strict. Do not use `any` unless a nearby comment explains why a safer type is not practical.
- Prefer existing aliases such as `@/*` and existing helper modules in `src/lib/`.
- Keep components focused. Move logic only when it is shared or meaningfully clarifies the current change.
- Do not add dependencies without explaining why React Native, Supabase, or existing utilities are insufficient.
- Do not format unrelated files. Do not make cosmetic-only edits while implementing a functional task.
- Add comments only for non-obvious behaviour, permissions, privacy boundaries, or platform quirks.

## Security rules

- Never commit secrets, real `.env` values, tokens, API keys, keystores, or private signing material.
- Validate external input before saving or using it: shared URLs, place data, usernames, profile fields, deep links, edge-function requests, and coordinates.
- Do not rely on frontend checks for data security. Preserve Supabase RLS, auth checks, and ownership filters.
- Respect stash visibility: private data stays owner-only; friends/public reads must match existing RLS and UI rules.
- Treat location data as sensitive. Do not log precise locations, background-location events, private routes, or sensitive place history.
- Do not log tokens, secrets, private user data, or sensitive location data.
- Do not swallow errors silently. Surface user-safe messages and keep developer logs free of sensitive values.

## Testing rules

- Add or update tests for meaningful behaviour changes, especially parsing, auth, RLS-adjacent logic, proximity, notifications, deep links, and data transforms.
- Prefer focused Jest tests near the changed code before broad checks.
- Run `npm run tsc` after TypeScript/API shape changes.
- Run `npm run lint` after edits that may affect style or imports.
- Run `npm test` when behaviour, hooks, parsing, or shared utilities change.
- Do not claim tests, lint, typecheck, or build passed unless they were actually run.

## Git/commit rules

- Keep diffs small and task-scoped.
- Check `git status --short` before summarising work.
- Do not revert user changes unless explicitly asked.
- Use Conventional Commit messages when committing:
  - `feat: add stash category filter`
  - `fix: prevent duplicate place saves`
  - `security: validate share payload before insert`
  - `docs: add agent rules for Cache development`
- Allowed commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, `security:`, `ci:`.
- Do not use vague messages such as `update`, `fix`, `changes`, `final`, or `ai changes`.
- Do not add AI footers such as `Generated with Claude`, `Generated with ChatGPT`, or `Co-Authored-By: Claude`.

## Forbidden

Agents must not:

- Commit secrets or real environment values.
- Use `any` without a documented reason.
- Refactor unrelated code.
- Reformat unrelated files.
- Add new dependencies without justification.
- Create large new documentation files unless requested.
- Rewrite working code just to make it look nicer.
- Change package manager or tooling without approval.
- Bypass validation.
- Rely only on frontend checks for security.
- Ignore authentication or ownership boundaries.
- Log tokens, secrets, private user data, or sensitive location data.
- Silently swallow errors.
- Pretend checks passed if they were not run.
- Produce long summaries when a short one is enough.
- Add AI-generated footers, decorative comments, or marketing language.

## Definition of Done

A task is done only when:

1. The requested change is implemented.
2. The diff is small and focused.
3. Existing patterns are followed.
4. External input is validated where relevant.
5. Auth, ownership, and privacy rules are respected where relevant.
6. Tests are added or updated for meaningful behaviour changes.
7. Relevant checks were run.
8. The final response states:
   - files changed
   - checks run
   - anything not run
   - risks or follow-up work

Do not claim that tests, typecheck, lint, or build passed unless they were actually run.
