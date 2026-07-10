import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';

import {SOCIAL_CHANNEL_ID} from './notifications';
import {requestOpenStash} from '../navigation/navigationRef';

/**
 * Remote-push layer: receiving the "you crossed paths" push sent by
 * supabase/functions/notify-overlap and deep-linking a tap to the matched
 * stash — mirrors the local-notification tap handling in ./notifications.ts,
 * which this is otherwise unrelated to (that one is geofence arrival/nearby;
 * this one is the friend-overlap push token registered in usePushToken.ts).
 */

function stashIdFrom(
  message: FirebaseMessagingTypes.RemoteMessage,
): string | null {
  const value = message.data?.stashId;
  return typeof value === 'string' ? value : null;
}

function openFromMessage(message: FirebaseMessagingTypes.RemoteMessage): void {
  const stashId = stashIdFrom(message);
  if (stashId) {
    requestOpenStash(stashId);
  }
}

/**
 * Must be called as early as possible (index.js, before the UI mounts) so a
 * tap that cold-starts the app from a killed state still resolves.
 */
export function configureRemoteNotifications(): void {
  // Android drops messages delivered while the app isn't running unless a
  // background handler is registered, even a no-op one.
  messaging().setBackgroundMessageHandler(async () => undefined);

  messaging().onNotificationOpenedApp(openFromMessage);

  messaging()
    .getInitialNotification()
    .then(message => {
      if (message) {
        openFromMessage(message);
      }
    });

  // FCM doesn't auto-display a system banner while the app is foregrounded;
  // mirror it as a local notification so a friend who's online right now
  // still sees something instead of silently missing it.
  messaging().onMessage(async message => {
    const {title, body} = message.notification ?? {};
    if (!title && !body) {
      return;
    }
    PushNotification.localNotification({
      channelId: SOCIAL_CHANNEL_ID,
      title: title ?? 'Cache',
      message: body ?? '',
      userInfo: message.data,
    });
  });
}
