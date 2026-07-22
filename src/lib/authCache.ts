import AsyncStorage from '@react-native-async-storage/async-storage';

import type {Profile} from '../types';

/**
 * Caches the signed-in user's profile so a returning user's app renders from the
 * last-known profile immediately on cold start, instead of holding the splash on
 * a `profiles` network round-trip. The cached copy is revalidated in the
 * background (see `initAuth`) and cleared on sign-out.
 *
 * Fire-and-forget on write — a stale cached profile is corrected by the next
 * fetch, so it is never worth blocking a render.
 */
const KEY = 'auth:profile';

interface CachedProfile {
  userId: string;
  profile: Profile;
}

/** Load the cached profile, but only when it belongs to the given session user. */
export async function loadCachedProfile(
  userId: string,
): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<CachedProfile>;
    if (parsed.userId === userId && parsed.profile) {
      return parsed.profile as Profile;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCachedProfile(userId: string, profile: Profile): void {
  const payload: CachedProfile = {userId, profile};
  AsyncStorage.setItem(KEY, JSON.stringify(payload)).catch(() => {});
}

export function clearCachedProfile(): void {
  AsyncStorage.removeItem(KEY).catch(() => {});
}
