import React, {useEffect} from 'react';
import {AppState, StatusBar, StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import BackgroundFetch from 'react-native-background-fetch';

import {CacheThemeProvider, useAppTheme} from './src/lib/theme';
import {runProximityCheck} from './src/lib/proximity';
import {requestNotificationPermissions} from './src/lib/notifications';
import {initAuth, useAuth} from './src/hooks/useAuth';
import {clearStashes, refreshStashes} from './src/hooks/useStashes';
import {clearFriends, refreshFriends} from './src/hooks/useFriends';
import {clearOverlaps, reconcileFriendOverlaps} from './src/hooks/useOverlaps';
import {clearPushToken, registerPushToken} from './src/hooks/usePushToken';
import {useGeofenceSync} from './src/hooks/useGeofenceSync';
import {primeLocation} from './src/hooks/useLocation';
import {RootNavigator} from './src/navigation/RootNavigator';
import {OverlapAlertDialog} from './src/components/OverlapAlertDialog';

/**
 * Configure react-native-background-fetch.
 *
 * The spec asks for a check "every 10 minutes". Both iOS (BGTaskScheduler) and
 * Android (WorkManager) enforce a 15-minute floor for periodic background work,
 * so we request 15 — the closest reliable cadence. The OS may run it less often
 * under battery pressure; that is expected and acceptable for proximity nudges.
 */
async function configureBackgroundFetch(): Promise<void> {
  await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_NONE,
    },
    async (taskId: string) => {
      await runProximityCheck();
      BackgroundFetch.finish(taskId);
    },
    (taskId: string) => {
      // Called when a task times out; we must still signal completion.
      BackgroundFetch.finish(taskId);
    },
  );
}

function App(): React.JSX.Element {
  return (
    <CacheThemeProvider>
      <AppShell />
    </CacheThemeProvider>
  );
}

function AppShell(): React.JSX.Element {
  const {status} = useAuth();
  const {colors, statusBarStyle} = useAppTheme();

  // Once signed in, mirror unvisited stashes into native iOS geofences (no-op on
  // Android, which uses the background-fetch poller below).
  useGeofenceSync(status === 'ready');

  // One-time startup: restore the session, ask for notifications, schedule the
  // background proximity task.
  useEffect(() => {
    initAuth();
    requestNotificationPermissions();
    configureBackgroundFetch();
  }, []);

  // Keep the stash store in lock-step with auth. The moment the user is signed
  // in (still behind the loading splash), ask for location + warm a first fix so
  // the map can open centered on them rather than prompting after it renders.
  useEffect(() => {
    if (status === 'ready') {
      primeLocation();
      // Load my pins + friends, then check for places we've both saved.
      Promise.all([refreshStashes(), refreshFriends()]).then(() =>
        reconcileFriendOverlaps(),
      );
      registerPushToken();
    } else if (status === 'signedOut') {
      clearStashes();
      clearFriends();
      clearOverlaps();
      clearPushToken();
    }
  }, [status]);

  // Re-check overlaps whenever the app returns to the foreground — this is how a
  // friend gets notified that you saved a place they'd already saved.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        reconcileFriendOverlaps();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView
      style={[styles.root, {backgroundColor: colors.background}]}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={statusBarStyle}
          backgroundColor={colors.background}
        />
        <RootNavigator />
        <OverlapAlertDialog />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
});

export default App;
