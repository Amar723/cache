# Cache — Launch Checklist

Everything to complete before shipping to testers. Grouped by phase. Items
marked **[done]** are already handled in code — don't redo them.

---

## 0. Code health (already green)

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — 57 passing
- [x] `npm run lint` — clean

Re-run these after any change before you build.

---

## 1. Supabase backend (do once, in the SQL editor)

- [ ] Run migrations **in order**: `schema.sql` → `rls.sql` → `storage.sql` →
      `friends.sql` → `account.sql`
- [ ] **Verify RLS isolation** (critical): sign in as two users; confirm a
      friend cannot see your `private` pins and a stranger sees nothing
- [ ] Auth → Providers → **Email** enabled
- [ ] Auth → Email → **"Confirm email" OFF** (or accept the "check your email"
      flow — the app handles both)
- [ ] Auth → URL Configuration → **Redirect URLs** → add `cache://auth/recovery`
      (password reset)
- [ ] Deploy the Places proxy so the key stays server-side:
  ```bash
  supabase secrets set GOOGLE_PLACES_API_KEY=your-places-key
  supabase functions deploy places
  ```

---

## 2. API keys & Google Cloud

- [ ] `.env` has real `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
      `GOOGLE_MAPS_API_KEY_IOS`, `GOOGLE_MAPS_API_KEY_ANDROID`
- [ ] **iOS Maps key** (`GOOGLE_MAPS_API_KEY_IOS`): restrict to **iOS apps**, bundle
      id `com.goldenavenue.cache`, + API **Maps SDK for iOS**
- [ ] **Android Maps key** (`GOOGLE_MAPS_API_KEY_ANDROID`): restrict to **Android
      apps**, package `com.cache` + SHA-1, + API **Maps SDK for Android**
- [ ] **Places key** (server secret, from step 1): restrict to **Places API only**
- [ ] **Billing budget + daily quota caps** in Google Cloud (caps the damage if a
      key leaks)
- [ ] Rebuild the native app after any `.env` change (keys bake in at build time)
- [ ] *(optional)* Set `SENTRY_DSN` in `.env` for crash reporting

---

## 3. iOS build & TestFlight

- [x] **App icon** generated (all sizes, no alpha) — just Clean Build Folder
- [ ] Enrolled in the **Apple Developer Program** ($99/yr) — required for TestFlight
- [ ] `cd ios && pod install` (picks up Sentry + native changes)
- [ ] Archive in Xcode → upload to App Store Connect → TestFlight
- [ ] Add **internal** testers (instant) — external testers need Beta App Review (~1 day)

---

## 4. Android build & distribution

- [x] Release signing config wired (`build.gradle`)
- [x] Manifest: permissions, Maps key, share intent (`AndroidManifest.xml`)
- [ ] Generate the upload keystore + put the 4 creds in `~/.gradle/gradle.properties`
      (command is in `android/gradle.properties`)
- [ ] Confirm the launcher icon is **yours**, not the React Native default
- [ ] Build: `cd android && ./gradlew bundleRelease` (AAB for Play) or
      `assembleRelease` (APK for direct send)
- [ ] Distribute via Play Internal Testing, or send the signed APK directly
      (testers enable "install unknown apps")

---

## 5. On-device verification (the part no one can test for you)

Smoke-test on a real device of each platform you ship:

- [ ] **Core loop**: sign up → onboarding → save a place via "+" → pin appears
      on map → add a friend (request/accept) → open friend's map → delete account
- [ ] **Address search** works (proves the Places Edge Function is live)
- [ ] **Map** opens centered on your current location
- [ ] **Share-to-app**: share a TikTok / Instagram Reel → app opens to "Add to
      Cache" prefilled *(iOS share path still unconfirmed — verify with the
      `[Cache]` Console logs)*
- [ ] **Password reset**: forgot password → email → link → set new password
- [ ] **Background proximity** (hardest): grant "Always" / "Allow all the time",
      fully kill the app, approach a saved **open** place, expect the nudge
      *(does not work in the simulator)*

---

## 6. Public store launch only (not needed for a friends beta)

- [ ] **Privacy policy** hosted somewhere (you collect location) — required by both stores
- [ ] App Store privacy "nutrition labels"
- [ ] Google Play Data Safety form

---

## Known gaps to tell testers about

- iOS share-to-app and killed-state proximity are **unconfirmed on-device**.
- iOS never sends the "you arrived" (<100 m) nudge by design — only the 1 km
  "nearby" one. Android sends both.
- No realtime push for friend requests yet (the badge refreshes on app/tab focus).
