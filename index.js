/**
 * Cache — app entry point.
 *
 * Registers the root component, the Android headless background-fetch task, and
 * configures push notifications before the UI mounts.
 */
// Must come first: polyfills global.crypto.getRandomValues, which uuid (used by
// react-native-google-places-autocomplete for session tokens) needs and RN's
// engine doesn't provide.
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';

import App from './App';
import {name as appName} from './app.json';
import {configureNotifications} from './src/lib/notifications';
import {configureRemoteNotifications} from './src/lib/remoteNotifications';
import {runProximityCheck} from './src/lib/proximity';
import {initMonitoring, wrapApp} from './src/lib/monitoring';

// Start crash/error reporting first so failures during the rest of startup are
// captured (no-op until SENTRY_DSN is set).
initMonitoring();

// Configure the local-notification channel as early as possible so taps that
// cold-start the app still resolve their deep link.
configureNotifications();
configureRemoteNotifications();

/**
 * Android headless task. Fires when the OS wakes the app for a background
 * fetch event while the JS context is not already running.
 */
const backgroundFetchHeadlessTask = async event => {
  const {taskId, timeout} = event;
  if (timeout) {
    BackgroundFetch.finish(taskId);
    return;
  }
  try {
    await runProximityCheck();
  } finally {
    BackgroundFetch.finish(taskId);
  }
};

BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);

// `wrapApp` adds Sentry's error-boundary + performance instrumentation when a
// DSN is configured, and is a transparent pass-through otherwise (wrapping
// without `Sentry.init` makes the SDK warn at startup).
AppRegistry.registerComponent(appName, () => wrapApp(App));
