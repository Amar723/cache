import {useEffect, useRef, useState} from 'react';
import {Alert, Linking, PermissionsAndroid, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';

import type {LatLng} from '../lib/distance';
import {loadLastLocation, saveLastLocation} from '../lib/lastLocation';

/** Set once we've asked for background location, so we never nag. */
const BG_LOCATION_PROMPTED_KEY = 'perm:bgLocationPrompted';

/**
 * Foreground device location for the map screen.
 *
 * Requests the runtime permission, then watches position. We deliberately keep
 * this separate from the background proximity engine (which takes a single fix
 * via `lib/geo.ts`) so the map can stream smooth updates without affecting the
 * battery-sensitive background path.
 */
export type LocationPermission = 'unknown' | 'granted' | 'denied';

interface UseLocationResult {
  location: LatLng | null;
  permission: LocationPermission;
  error: string | null;
}

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location access',
        message:
          'Cache shows your position on the map and notifies you near saved places.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  // iOS: configured for whenInUse; this surfaces the system prompt.
  Geolocation.requestAuthorization();
  return true;
}

/**
 * Escalate to background location on Android, once. The background proximity
 * poll (Android only) needs "Allow all the time", which the OS deliberately
 * won't grant in the same dialog as foreground access:
 *   - Pre-Android 10 (API < 29): granted with the foreground permission.
 *   - Android 10 (API 29): can be granted from a permission dialog.
 *   - Android 11+ (API 30+): only selectable in Settings, so we explain why and
 *     deep-link the user there.
 * Call this *after* foreground access is granted. It never blocks the map.
 */
async function requestBackgroundLocation(): Promise<void> {
  if (Platform.OS !== 'android' || typeof Platform.Version !== 'number') {
    return;
  }
  if (Platform.Version < 29) {
    return;
  }

  const permission = PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION;
  if (await PermissionsAndroid.check(permission)) {
    return;
  }
  // Ask at most once; respect the user's answer thereafter.
  if (await AsyncStorage.getItem(BG_LOCATION_PROMPTED_KEY)) {
    return;
  }
  await AsyncStorage.setItem(BG_LOCATION_PROMPTED_KEY, '1');

  // Android 10 can still grant it straight from a runtime dialog.
  if (Platform.Version === 29) {
    const result = await PermissionsAndroid.request(permission, {
      title: 'Background location',
      message:
        'Allow Cache to use your location in the background so it can nudge you when you walk near a place you saved.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });
    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      return;
    }
  }

  // Android 11+ (or a denied Android 10 dialog): the system only exposes this in
  // Settings, so guide the user there.
  Alert.alert(
    'Get nearby nudges',
    'To remind you when you’re near a saved place, set Cache’s location access to “Allow all the time.”',
    [
      {text: 'Not now', style: 'cancel'},
      {text: 'Open settings', onPress: () => Linking.openSettings()},
    ],
  );
}

/**
 * Request location permission and warm a first fix as early as possible — call
 * this the moment the app reaches its signed-in state (while the loading splash
 * is still up) so the system prompt overlaps the wait and a position is cached
 * by the time the map renders. Idempotent: only the first call does work.
 */
let primed = false;
export async function primeLocation(): Promise<void> {
  if (primed) {
    return;
  }
  primed = true;
  const granted = await requestPermission();
  if (!granted) {
    return;
  }
  Geolocation.getCurrentPosition(
    pos =>
      saveLastLocation({lat: pos.coords.latitude, lng: pos.coords.longitude}),
    () => {},
    {enableHighAccuracy: false, timeout: 15000, maximumAge: 60000},
  );
}

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [permission, setPermission] = useState<LocationPermission>('unknown');
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  // Distinguishes a real GPS fix from the cached seed below, so a stale cached
  // value never overwrites a fresh fix that arrived first.
  const hasLiveFix = useRef(false);

  // Seed from the last known location so the map opens near the user before a
  // fresh fix arrives. Pure cache read — works even before permission resolves.
  useEffect(() => {
    let mounted = true;
    loadLastLocation().then(cached => {
      if (mounted && cached && !hasLiveFix.current) {
        setLocation(cached);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const granted = await requestPermission();
      if (!mounted) {
        return;
      }
      if (!granted) {
        setPermission('denied');
        setError('Location permission denied.');
        return;
      }
      setPermission('granted');

      watchId.current = Geolocation.watchPosition(
        pos => {
          if (!mounted) {
            return;
          }
          const next = {lat: pos.coords.latitude, lng: pos.coords.longitude};
          hasLiveFix.current = true;
          setLocation(next);
          saveLastLocation(next);
          setError(null);
        },
        err => {
          if (mounted) {
            setError(err.message);
          }
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 25,
        },
      );

      // Now that foreground access is granted, offer the background upgrade the
      // Android proximity poll needs. Fire-and-forget so the map isn't blocked.
      requestBackgroundLocation().catch(() => {});
    })();

    return () => {
      mounted = false;
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, []);

  return {location, permission, error};
}
