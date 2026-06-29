import {createNavigationContainerRef} from '@react-navigation/native';

import type {RootStackParamList} from '../types';

/**
 * Global navigation handle + a tiny event bus for "open this stash's sheet".
 *
 * Notification taps can arrive (a) while a screen is mounted, or (b) on a cold
 * start before any screen exists. We handle both:
 *   - We navigate via the ref to the Map tab.
 *   - We remember the requested stash id (`pendingStashId`) so a screen that
 *     mounts *after* the tap can still pick it up via `consumePendingStash`.
 *   - Already-mounted screens react immediately through `subscribeOpenStash`.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type OpenStashListener = (stashId: string) => void;

const listeners = new Set<OpenStashListener>();
let pendingStashId: string | null = null;

/**
 * Ask the app to surface a stash's detail sheet. Safe to call before the
 * navigator is ready — the pending id will be consumed on first mount.
 */
export function requestOpenStash(stashId: string): void {
  pendingStashId = stashId;

  if (navigationRef.isReady()) {
    navigationRef.navigate('Tabs', {screen: 'Map'});
  }

  // Notify any live subscribers (e.g. MapScreen already on screen).
  listeners.forEach(listener => listener(stashId));
}

/** Subscribe to live open-stash requests. Returns an unsubscribe function. */
export function subscribeOpenStash(listener: OpenStashListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Read and clear the pending stash id. Call this from a screen's mount effect
 * so cold-start deep links resolve once the UI exists.
 */
export function consumePendingStash(): string | null {
  const id = pendingStashId;
  pendingStashId = null;
  return id;
}
