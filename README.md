# Cache

A location-saving app. See a TikTok or Reel of a place worth visiting, share it
to **Cache**, tag the place, and it drops a pin on your personal retro map. When
you're near a saved place you get a nudge; when you arrive you mark it visited.
Visited and unvisited pins look different.

**Phase 2 (friends maps) is built**: add friends by username and browse their
shared pins on a read-only map, with per-stash Private/Friends visibility. The
Phase 3 (candid photo prompt) roadmap shaped the remaining architecture. See
[Roadmap readiness](#roadmap-readiness).

- React Native **0.74** (bare, **not** Expo) + TypeScript
- Supabase for auth, Postgres, and storage
- Google Maps + Google Places
- Local proximity notifications driven by a background fetch

---

## Table of contents

1. [What's in this repo](#whats-in-this-repo)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Step 1 — Generate the native shell](#step-1--generate-the-native-shell)
5. [Step 2 — Install dependencies](#step-2--install-dependencies)
6. [Step 3 — Environment variables & API keys](#step-3--environment-variables--api-keys)
7. [Step 4 — Supabase setup](#step-4--supabase-setup)
8. [Step 5 — Fonts](#step-5--fonts)
9. [Step 6 — iOS native configuration](#step-6--ios-native-configuration)
10. [Step 7 — Android native configuration](#step-7--android-native-configuration)
11. [Step 8 — Share extension](#step-8--share-extension)
12. [Step 9 — Run it](#step-9--run-it)
13. [Testing without the share extension](#testing-without-the-share-extension)
14. [Roadmap readiness](#roadmap-readiness)

---

## What's in this repo

This repository contains the **complete application source** (everything under
`src/`, plus `App.tsx` and `index.js`) and the native **configuration snippets**
you merge into the generated iOS/Android projects.

It does **not** vendor the generated `ios/` and `android/` folders — those are
machine- and version-specific and are meant to be created by the React Native
template (Step 1). Everything you need to wire them up lives in `native/` and in
the steps below.

```
src/
  screens/      MapScreen, SavedScreen, AddStashScreen, ProfileScreen, AuthScreen, OnboardingScreen
  components/   StashPin, StashBottomSheet, AddStashForm, CategoryPicker, Themed
  lib/          supabase, tiktok, notifications, proximity, distance, geo, storage, share, theme, format, config, store, database.types
  hooks/        useStashes, useLocation, useAuth
  navigation/   RootNavigator, TabNavigator, navigationRef
  types.ts
supabase/       schema.sql, rls.sql, storage.sql, friends.sql
native/         ios/ and android/ config snippets + the iOS Share Extension
assets/fonts/   drop DMSans + Lora TTFs here
```

## Architecture

- **State** lives in two tiny external stores (`src/lib/store.ts`) — one for auth
  and one for stashes. They use `useSyncExternalStore`, so the map, list, and
  profile all stay in sync, and the **background proximity engine reads the same
  Supabase data without needing a React tree**. No Context provider nesting.
- **`useAuth`** owns the session + profile lifecycle and exposes a `status`
  (`loading | signedOut | needsOnboarding | ready`) that the `RootNavigator`
  switches on. Sessions persist via Supabase + AsyncStorage.
- **`useStashes`** is the single source of truth for saved places. "Mark as
  visited" updates it once and the pin, the row, and the profile counts all
  reflect it instantly.
- **Proximity** is split cleanly: `distance.ts` (pure haversine + tiering),
  `notifications.ts` (channel, tap→deep-link, suppression), and `proximity.ts`
  (orchestration). The background task in `index.js` calls one function:
  `runProximityCheck()`.
- **Deep links** from notifications flow through `navigation/navigationRef.ts`,
  which handles both warm taps (live event) and cold-start taps (pending id).
- **The detail sheet** (`StashBottomSheet`) is one component used by both the map
  pin and the saved list, so the two entry points are identical by construction.

## Prerequisites

- Node ≥ 18, Yarn or npm
- Watchman (`brew install watchman`)
- **iOS:** Xcode 15+, CocoaPods (`sudo gem install cocoapods`), an Apple
  developer account (background modes require a real signing team; the share
  extension uses a `cache://` URL scheme, so **no** paid App Group is needed; the
  background proximity check does **not** run in the simulator)
- **Android:** Android Studio, JDK 17, an emulator or device with Google Play
  services (required for the Google Maps provider)
- A Supabase project and a Google Cloud project

## Step 1 — Generate the native shell

From the parent directory of this repo:

```bash
# Generate a matching-version RN project next to this one
npx @react-native-community/cli@latest init Cache --version 0.74.5 --directory cache-shell

# Copy the generated native projects into this repo
cp -R cache-shell/ios   ./ios
cp -R cache-shell/android ./android
cp cache-shell/Gemfile ./Gemfile 2>/dev/null || true
rm -rf cache-shell
```

You now have `ios/` and `android/` whose app name is `Cache` (matches
`app.json`). Keep **this** repo's `package.json`, `App.tsx`, `index.js`,
`babel.config.js`, `metro.config.js`, and `tsconfig.json` — they already include
every dependency and the path/reanimated Babel config.

## Step 2 — Install dependencies

```bash
npm install        # or: yarn
cd ios && pod install && cd ..
```

Autolinking wires up native modules. The two Babel plugins
(`module-resolver`, `react-native-reanimated/plugin`) are already configured.

## Step 3 — Environment variables & API keys

Copy the template and fill it in:

```bash
cp .env.example .env
```

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
GOOGLE_MAPS_API_KEY=
GOOGLE_PLACES_API_KEY=
```

`react-native-config` exposes these to JS via `src/lib/config.ts`. **Rebuild the
native app after changing `.env`** (env values are baked in at build time).

### How to obtain each key

**Supabase** — [supabase.com](https://supabase.com) → New project. Then
**Project Settings → API**:
- `SUPABASE_URL` = "Project URL"
- `SUPABASE_ANON_KEY` = "Project API keys → anon public"

**Google Maps & Places** — [Google Cloud Console](https://console.cloud.google.com):
1. Create a project, then **APIs & Services → Library** and enable:
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Places API** (for `react-native-google-places-autocomplete`)
2. **APIs & Services → Credentials → Create credentials → API key**.
3. Create **two** keys and restrict them (recommended):
   - `GOOGLE_MAPS_API_KEY`: restrict to the Maps SDKs, and to your iOS bundle id
     / Android package + SHA-1.
   - `GOOGLE_PLACES_API_KEY`: restrict to the Places API.
   (One key with all three APIs works too; two keys keeps the surface small and
   matches the env var split the spec asks for.)
4. Enable **Billing** on the Cloud project — Maps/Places require it even on the
   free tier.

## Step 4 — Supabase setup

In the Supabase dashboard:

1. **SQL editor** → run, in order:
   - `supabase/schema.sql` — the `profiles` and `stashes` tables (+ helpful
     indexes).
   - `supabase/rls.sql` — enables RLS, the owner-only policies, and profile
     discoverability (so friend search by username works).
   - `supabase/storage.sql` — creates the public `avatars` bucket and its
     per-user write policies.
   - `supabase/friends.sql` — Phase 2: the `friendships` table, its RLS, and the
     policy that lets accepted friends read each other's visible stashes.
   - `supabase/account.sql` — the `delete_account()` RPC behind "Delete account".
2. **Authentication → Providers → Email**: ensure Email is enabled.
3. **Authentication → Sign In / Providers → Email → "Confirm email"**: turn this
   **OFF** for the MVP so sign-up returns a live session and goes straight to
   onboarding. (If you leave it on, sign-up shows a "check your email" message
   and the user logs in after confirming — the app handles both.)
4. **Authentication → Email Templates → Reset Password**: edit the template to
   show the one-time code (`{{ .Token }}`) instead of the magic-link button —
   e.g. "Your code is {{ .Token }}". The app has the user type this code in
   rather than tapping a link, since mail-provider link scanners (Gmail's Safe
   Browsing, etc.) silently consume magic-link tokens before the user ever
   clicks them.
5. **Places proxy (Edge Function)** — address autocomplete is proxied so the
   Places API key never ships in the app. Deploy it and set the secret:
   ```bash
   supabase secrets set GOOGLE_PLACES_API_KEY=your-places-key
   supabase functions deploy places
   ```
   Without this, the address search in "Add a place" won't work. The key only
   ever lives here, server-side — restrict it to the Places API in Google Cloud.

That's the whole backend. RLS guarantees each user only ever sees their own rows.

## Step 5 — Fonts

Download the TTFs and drop them in `assets/fonts/` (see `assets/fonts/.gitkeep`):

- DM Sans: `DMSans-Regular.ttf`, `DMSans-Medium.ttf`, `DMSans-Bold.ttf`
- Lora: `Lora-Regular.ttf`, `Lora-Bold.ttf`

Then link them:

```bash
npx react-native-asset
```

This copies them into the iOS bundle (and registers `UIAppFonts`) and the
Android `assets/fonts`. The family names in `src/lib/theme.ts` match the
PostScript names.

## Step 6 — iOS native configuration

All snippets are in [`native/ios/Info.plist-additions.md`](native/ios/Info.plist-additions.md). Summary:

1. **Info.plist** — add the location, photo-library, background-modes,
   `BGTaskSchedulerPermittedIdentifiers`, and `LSApplicationQueriesSchemes`
   (tiktok/instagram) keys.
2. **Google Maps** — in `AppDelegate.mm` call
   `[GMSServices provideAPIKey:@"YOUR_GOOGLE_MAPS_API_KEY"];` and add the
   `react-native-google-maps` pod to the `Podfile`, then `pod install`.
3. **Capabilities** (Signing & Capabilities): enable **Background Modes**
   (Background fetch + Background processing + Location updates), and **Push
   Notifications** is *not* required (these are local notifications only).
4. **react-native-background-fetch** and **react-native-push-notification**
   follow their standard iOS installs (the Podfile + AppDelegate hooks from each
   library's README). Both autolink; push-notification needs the
   `UNUserNotificationCenter` delegate lines from its iOS guide.

## Step 7 — Android native configuration

All snippets are in
[`native/android/AndroidManifest-additions.xml`](native/android/AndroidManifest-additions.xml). Summary:

1. **AndroidManifest.xml** — add the location (incl. `ACCESS_BACKGROUND_LOCATION`),
   `POST_NOTIFICATIONS`, and `RECEIVE_BOOT_COMPLETED` permissions; add the Google
   Maps `meta-data` key; set `MainActivity` to `launchMode="singleTask"`; add the
   `ACTION_SEND` `text/plain` intent-filter (share target).
2. **Maps key** — put your `GOOGLE_MAPS_API_KEY` in the
   `com.google.android.geo.API_KEY` meta-data value.
3. `react-native-background-fetch` adds its own `HeadlessTask` service via
   autolinking; the headless JS task is registered in `index.js`.

## Step 8 — Share extension

> **Approach — a custom URL scheme, no App Group, no extra library.** A share
> must **open the AddStash screen inside the app**. Rather than an App Group
> (which needs a *paid* Apple Developer account) or a third-party share library,
> Cache uses its own `cache://` URL scheme: the iOS Share Extension hands the
> link to the app as a `cache://share?url=<encoded>` deep link, and the app
> picks it up through React Native's `Linking` API. Android does the same — its
> `MainActivity` rewrites the incoming `ACTION_SEND` intent into the same
> `cache://share?url=…` deep link. So both platforms funnel through one JS path
> (`src/lib/share.ts`, wired in `RootNavigator`), and **no native module is
> required** (`react-native-share-menu` is *not* used).

**iOS** (Share Extension target):

1. In Xcode: **File → New → Target → Share Extension**, name it exactly
   **`ShareExtension`**. The target's files live in
   [`ios/ShareExtension/`](ios/ShareExtension): `Info.plist` (a predicate
   activation rule that matches any share containing a URL or text) and
   `ShareViewController.swift` (extracts the link, opens the host app via the
   `cache://` scheme by messaging the `UIApplication` on the responder chain,
   then dismisses).
2. Register the scheme on the **main app**: `CFBundleURLTypes` in
   `ios/Cache/Info.plist` declares `cache`, and `AppDelegate.mm` forwards
   `application:openURL:options:` to `RCTLinkingManager`. No App Group, no
   shared container, no extra capability.

**Android** (manifest + `MainActivity`):

1. `AndroidManifest.xml` gives `MainActivity` `launchMode="singleTask"`, an
   `ACTION_SEND` `text/plain` intent-filter (the share target), and a `cache://`
   `VIEW` intent-filter (deep-link parity with iOS).
2. `MainActivity.kt` converts an incoming `ACTION_SEND` (its `EXTRA_TEXT`) into a
   `cache://share?url=…` intent in `onCreate`/`onNewIntent`, so RN's `Linking`
   delivers it to the same JS handler.

On both platforms `src/lib/share.ts` reads the `cache://share?url=…` link
(`Linking.getInitialURL` for a cold start, the `url` event while running),
extracts the original video URL, and `RootNavigator` navigates to `AddStash`. If
a share arrives before the user has logged in/onboarded, it is held and replayed
when they reach the `ready` state.

## Step 9 — Run it

```bash
npm start            # Metro
npm run ios          # or: npm run android
```

First launch → Auth → Onboarding (display name, unique username, optional photo)
→ Map. Share a TikTok/Reel into Cache, tag the place, and watch the pin appear.

## Testing without the share extension

The share extension is the only piece that needs real native setup and a device.
To exercise the rest immediately, the **AddStash form accepts a pasted link**:

- The form has a **Video link** field (pre-filled when you arrive via a share).
- Paste any TikTok URL, e.g.
  `https://www.tiktok.com/@nba/video/7234567890123456789`; the oEmbed thumbnail
  loads after ~0.5s. An unreachable URL falls back to a plain placeholder showing
  the link — exactly as it does in production.

To exercise proximity locally, set a stash near your simulated location and use
the simulator's **Features → Location → Custom Location** (iOS) or the emulator's
**Extended controls → Location** (Android), then trigger the background task:

```bash
# Android: simulate a background-fetch event
adb shell cmd jobscheduler run -f com.cache 999

# iOS background tasks only run on a real device; or call runProximityCheck()
# from a temporary button while developing.
```

## Roadmap readiness

- **Phase 2 — Friends maps. ✅ Implemented.** Mutual request/accept friendships
  (`supabase/friends.sql`), username search, a requests inbox with a tab badge,
  and a read-only friend map that reuses `RETRO_MAP_STYLE`, `StashPin`, and
  `StashBottomSheet` (in `readOnly` mode). Each stash carries a `visibility`
  toggle (Private / Friends), and RLS lets accepted friends read each other's
  non-private pins. Data lives in `useFriends` / `useFriendStashes`. Not yet
  built: a `'public'` global tier, blocking, and realtime request push.
- **Phase 3 — Candid photo prompt.** The proximity engine already detects the
  "arrived" tier (`classifyTier`) and the suppression store keys by stash + date.
  A 5-minute random photo prompt hangs off the same `runProximityCheck` arrival
  event, and `lib/storage.ts` already uploads images to Supabase Storage — point
  it at a `stash-photos` bucket and add a `photo_url` column. No screen or
  component needs to move.
```
