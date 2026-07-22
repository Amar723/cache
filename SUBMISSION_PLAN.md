# TestFlight Submission Plan — target: Thursday 23 Jul

Scope: **iOS TestFlight beta only.** Android is out of scope for this submission.
Confirmed working on device: share-to-app, killed-state proximity. iOS fires only
the 1 km "nearby" nudge (the behavior you want).

Re-run `npx tsc --noEmit && npm test && npx eslint . --ext .ts,.tsx` after any code
change, before any build.

---

## DAY 1 — Today (21 Jul): code clean + backend live

### A. Get the tree clean (30 min)
- [ ] `npx eslint . --ext .ts,.tsx --fix` (clears the 2 prettier errors)
- [ ] Review the outstanding diff (20 files, +613/−157) + the 2 untracked files
      (`src/lib/authCache.ts`, `jest.setup.js`)
- [ ] Commit it
- [ ] Re-run: `npx tsc --noEmit && npm test` → must be green (90 tests)

### B. Supabase backend (45 min, do once in SQL editor)
- [ ] Run migrations **in order**: `schema.sql` → `rls.sql` → `storage.sql` →
      `friends.sql` → `account.sql` (plus `add_default_city.sql`,
      `push_notifications.sql` if not already applied)
- [ ] Auth → Providers → **Email** enabled
- [ ] Auth → **"Confirm email" OFF** (or accept the check-your-email flow)
- [ ] Auth → Email Templates → **Reset Password** → use `{{ .Token }}` (code, not link)
- [ ] Deploy edge functions:
      `supabase secrets set GOOGLE_PLACES_API_KEY=<key>` then
      `supabase functions deploy places` (also `instagram-oembed`, `notify-overlap`)

### C. API keys + Google Cloud (30 min)
- [ ] iOS Maps key restricted to **iOS apps**, bundle id `com.goldenavenue.cache`,
      API = Maps SDK for iOS
- [ ] Places key restricted to **Places API only** (server secret from step B)
- [ ] **Billing budget + daily quota caps** set (caps damage if a key leaks)
- [ ] `.env` has real `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_MAPS_API_KEY_IOS`
- [ ] *(optional)* `SENTRY_DSN` for crash reports

### D. Privacy policy (30 min) — needed for external testers
- [ ] Write a privacy policy (you collect location + email; you already have
      `legal/TERMS_OF_SERVICE.md` + `legal/DATA_DELETION.md` as a base)
- [ ] Host it at a public URL (GitHub Pages / Notion / any static host)
- [ ] Save the URL — you'll paste it into App Store Connect on Day 2

---

## DAY 2 — Tomorrow (22 Jul): verify on device + build

### E. Critical on-device checks (must pass before inviting anyone)
- [ ] **RLS privacy isolation**: create 2 accounts (user A + throwaway user B).
      Confirm B **cannot** see A's `private` pins, and a non-friend sees nothing.
      *(This is the privacy guarantee — do not skip.)*
- [ ] **Core loop**: sign up → onboarding → save a place via "+" → pin on map →
      A and B friend each other (request/accept) → open friend's map → mark
      visited → delete account
- [ ] **Address search** works (proves the Places function is live)
- [ ] **Map** opens centered on current location
- [ ] **Share-to-app** prefills Add-to-Cache (re-confirm on this build)
- [ ] **Password reset** end to end
- [ ] **Nearby proximity nudge** fires near an open saved place, app killed,
      "Always" location granted

### F. iOS build (45 min)
- [ ] Enrolled in **Apple Developer Program** ($99/yr) — required, do this first if not
- [ ] `cd ios && pod install`
- [ ] Bump build number, Archive in Xcode
- [ ] Upload to App Store Connect

---

## THURSDAY 23 Jul: submit

- [ ] In App Store Connect → TestFlight: confirm the build processed
- [ ] Fill **Export Compliance** (standard encryption exemption applies)
- [ ] Paste the **privacy policy URL** + fill "Test Information" (what to test / notes)
- [ ] **Internal testers** → invite (instant, no review)
- [ ] **External testers** (if any) → submit for Beta App Review (~1 day, so the
      external group may go live Fri) with these known-limitations notes:
      - Friend-request badge updates on app/tab focus, not instantly
      - iOS sends the 1 km "nearby" nudge only (no "arrived" alert) — by design

---

## Known limitations to tell testers
- Friend-request badge refreshes when you open the app / Friends tab (no live push).
- iOS sends only the 1 km "nearby" nudge (intended).
- Android is not part of this beta.
