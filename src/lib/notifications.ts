import {PermissionsAndroid, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification, {
  Importance,
  type ReceivedNotification,
} from 'react-native-push-notification';

import type {Stash} from '../types';
import {requestOpenStash} from '../navigation/navigationRef';

/**
 * Local-notification layer: channel configuration, tap handling (deep link to a
 * stash sheet), and tiered suppression bookkeeping.
 *
 * Suppression keys live in AsyncStorage:
 *   - Tier 1 (arrived):  `notif:tier1:<stashId>`            — set once, forever.
 *   - Tier 2 (nearby):   `notif:tier2:<stashId>:<YYYYMMDD>` — set once per day.
 */

export const CHANNEL_ID = 'cache-proximity';

type AnyNotification = Omit<ReceivedNotification, 'userInfo'> & {
  userInfo?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

/** Extract our stash id from either the iOS userInfo or Android data payload. */
function stashIdFrom(notification: AnyNotification): string | null {
  const fromData = notification.data?.stashId;
  const fromUserInfo = notification.userInfo?.stashId;
  const value = fromData ?? fromUserInfo;
  return typeof value === 'string' ? value : null;
}

let configured = false;

/**
 * Idempotently configure the notification channel and the global tap handler.
 * Called from index.js before the UI mounts so cold-start taps deep-link
 * correctly.
 */
export function configureNotifications(): void {
  if (configured) {
    return;
  }
  configured = true;

  PushNotification.configure({
    onNotification: notification => {
      const stashId = stashIdFrom(notification as AnyNotification);
      // `userInteraction` is true only when the user actually tapped it.
      if (stashId && notification.userInteraction) {
        requestOpenStash(stashId);
      }
      // Required on iOS to signal the OS we are done handling the event.
      notification.finish?.('UIBackgroundFetchResultNoData');
    },
    // We request permissions explicitly at the right moment instead.
    requestPermissions: Platform.OS === 'ios' ? false : true,
    popInitialNotification: true,
  });

  PushNotification.createChannel(
    {
      channelId: CHANNEL_ID,
      channelName: 'Nearby places',
      channelDescription: 'Reminders when you are near a cached place',
      importance: Importance.HIGH,
      vibrate: true,
    },
    () => undefined,
  );
}

/** Ask for notification permission (no-op result if already granted). */
export function requestNotificationPermissions(): void {
  if (Platform.OS === 'android') {
    // Android 13+ (API 33) gates notifications behind a runtime permission;
    // older versions grant it at install time from the manifest declaration.
    if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    }
    return;
  }
  PushNotification.requestPermissions(['alert', 'badge', 'sound']);
}

function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}${m}${d}`;
}

const tier1Key = (stashId: string) => `notif:tier1:${stashId}`;
const tier2Key = (stashId: string, day = localDateKey()) =>
  `notif:tier2:${stashId}:${day}`;

export async function hasFiredTier1(stashId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(tier1Key(stashId))) !== null;
}

export async function hasFiredTier2Today(stashId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(tier2Key(stashId))) !== null;
}

async function markTier1Fired(stashId: string): Promise<void> {
  await AsyncStorage.setItem(tier1Key(stashId), new Date().toISOString());
}

async function markTier2Fired(stashId: string): Promise<void> {
  await AsyncStorage.setItem(tier2Key(stashId), new Date().toISOString());
}

/** Tier 1 — within 100m. Fires once per stash, ever. */
export async function notifyArrived(stash: Stash): Promise<void> {
  PushNotification.localNotification({
    channelId: CHANNEL_ID,
    title: 'Cache',
    message: `You made it to ${stash.place_name} 📍 Mark it as visited?`,
    // RNPN surfaces userInfo on the tapped notification as `userInfo` (iOS) and
    // `data` (Android); the tap handler reads both.
    userInfo: {stashId: stash.id, tier: 'arrived'},
  });
  await markTier1Fired(stash.id);
}

/** Tier 2 — between 100m and 1km. Fires at most once per day per stash. */
export async function notifyNearby(stash: Stash): Promise<void> {
  PushNotification.localNotification({
    channelId: CHANNEL_ID,
    title: 'Cache',
    message: `You cached ${stash.place_name} — today looks like a great day to check it out 🗺️`,
    userInfo: {stashId: stash.id, tier: 'nearby'},
  });
  await markTier2Fired(stash.id);
}

/**
 * Clear suppression for a stash. Useful if a stash is deleted and a new one
 * reuses context, or for manual testing. Not used in the happy path but keeps
 * the suppression store from leaking semantics into callers.
 */
export async function clearSuppression(stashId: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter(
    k => k === tier1Key(stashId) || k.startsWith(`notif:tier2:${stashId}:`),
  );
  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove);
  }
}
