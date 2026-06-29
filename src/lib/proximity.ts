import {Platform} from 'react-native';

import {supabase} from './supabase';
import {getCurrentPosition} from './geo';
import {classifyTier, haversineMeters} from './distance';
import {isOpenNow} from './openingHours';
import {
  hasFiredTier1,
  hasFiredTier2Today,
  notifyArrived,
  notifyNearby,
} from './notifications';
import type {Stash} from '../types';

/**
 * The proximity engine. Runs on every background-fetch tick (and can be invoked
 * manually for testing). Pure orchestration — the tier maths lives in
 * distance.ts and the suppression/firing lives in notifications.ts.
 *
 * Flow:
 *   1. Require an authenticated session (the background task may outlive a
 *      logout; bail quietly if so).
 *   2. Load all *unvisited* stashes for the user — visited places are
 *      permanently suppressed by definition.
 *   3. Read the current device location once.
 *   4. For each stash, classify the distance and fire at most one notification,
 *      respecting suppression. Tier 1 takes priority; we never fire both tiers
 *      for the same stash in one pass (the if/else-if guarantees this).
 *
 * iOS no longer uses this poller: it relies on true CLLocationManager region
 * monitoring (see src/lib/geofencing.ts + ios/Cache/Geofencing), which is more
 * reliable and intentionally stays silent under 100m. We early-return on iOS to
 * avoid double-firing. Android keeps polling.
 */
export async function runProximityCheck(): Promise<void> {
  if (Platform.OS === 'ios') {
    return;
  }

  const {
    data: {session},
  } = await supabase.auth.getSession();

  if (!session) {
    return;
  }

  const {data, error} = await supabase
    .from('stashes')
    .select('*')
    .eq('user_id', session.user.id)
    .is('visited_at', null);

  if (error || !data || data.length === 0) {
    return;
  }

  const stashes = data as Stash[];

  let here;
  try {
    here = await getCurrentPosition();
  } catch {
    // No location fix this cycle (permissions off, indoors, etc.). Try again
    // on the next tick rather than firing on stale data.
    return;
  }

  for (const stash of stashes) {
    const distance = haversineMeters(here, {lat: stash.lat, lng: stash.lng});
    const tier = classifyTier(distance);

    if (tier === 'arrived') {
      // Tier 1: once per stash, ever.
      if (!(await hasFiredTier1(stash.id))) {
        await notifyArrived(stash);
      }
      continue; // Tier 1 priority — never also evaluate tier 2 for this stash.
    }

    if (tier === 'nearby') {
      // Tier 2: only when the place is open (unknown hours = allowed), at most
      // once per day per stash. Matches the native iOS geofence's open-now gate.
      if (
        isOpenNow(stash.opening_hours) &&
        !(await hasFiredTier2Today(stash.id))
      ) {
        await notifyNearby(stash);
      }
    }
  }
}
