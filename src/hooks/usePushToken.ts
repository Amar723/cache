import {Platform} from 'react-native';
import messaging from '@react-native-firebase/messaging';

import {supabase} from '../lib/supabase';
import {currentUserId} from './useAuth';
import type {PushPlatform} from '../lib/database.types';

/**
 * Remote push device-token bookkeeping. Registers this device's FCM token
 * against the signed-in user so the notify-overlap edge function
 * (supabase/functions/notify-overlap) can reach a friend the moment you both
 * save the same place, even if their app isn't open — see push_tokens in
 * supabase/push_notifications.sql. Local (geofence) notifications are
 * unrelated and stay on src/lib/notifications.ts's
 * react-native-push-notification setup.
 */

const PLATFORM: PushPlatform = Platform.OS === 'ios' ? 'ios' : 'android';

let unsubscribeRefresh: (() => void) | null = null;

/** Ask for permission, grab the current FCM token, and upsert it. Idempotent. */
export async function registerPushToken(): Promise<void> {
  const userId = currentUserId();
  if (!userId) {
    return;
  }

  const authStatus = await messaging().requestPermission();
  const granted =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  if (!granted) {
    return;
  }

  const token = await messaging().getToken();
  await upsertToken(userId, token);

  unsubscribeRefresh?.();
  unsubscribeRefresh = messaging().onTokenRefresh(newToken => {
    upsertToken(userId, newToken);
  });
}

async function upsertToken(userId: string, token: string): Promise<void> {
  await supabase
    .from('push_tokens')
    .upsert(
      {user_id: userId, token, platform: PLATFORM},
      {onConflict: 'user_id,token'},
    );
}

/** Drop this device's token on sign-out so it stops receiving pushes for this account. */
export async function clearPushToken(): Promise<void> {
  unsubscribeRefresh?.();
  unsubscribeRefresh = null;

  try {
    const token = await messaging().getToken();
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    // Best-effort; a stale row just means one fewer notification later.
  }
}
