import AsyncStorage from '@react-native-async-storage/async-storage';

import type {LatLng} from './distance';

/**
 * Persists the most recent device location so the map can open near the user
 * *before* a fresh GPS fix arrives. The OS won't hand us a position until the
 * user grants permission, so on a first launch there's nothing to show — but on
 * every return visit this lets us skip the "default city, then jump" flash.
 */
const KEY = 'loc:last';

export async function loadLastLocation(): Promise<LatLng | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<LatLng>;
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      return {lat: parsed.lat, lng: parsed.lng};
    }
    return null;
  } catch {
    return null;
  }
}

/** Fire-and-forget; a stale cached location is never worth blocking a render. */
export function saveLastLocation(loc: LatLng): void {
  AsyncStorage.setItem(KEY, JSON.stringify(loc)).catch(() => {});
}
