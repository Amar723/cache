import {NativeModules, Platform} from 'react-native';

import type {OpeningHours} from '../types';

/**
 * JS bridge to the native iOS geofencing module (`RNGeofencing`).
 *
 * iOS uses true CLLocationManager region monitoring (fires even when the app is
 * killed). Android has no native counterpart here — it stays on the
 * background-fetch polling engine — so every call is a no-op there.
 */

/** Minimal shape the native side needs to monitor a stash. */
export interface GeofenceStash {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Weekly hours so native can gate notifications to when the place is open. */
  openingHours: OpeningHours | null;
}

interface RNGeofencingModule {
  requestAlwaysAuthorization(): void;
  setGeofences(stashes: GeofenceStash[]): void;
  clearGeofences(): void;
}

const native: RNGeofencingModule | undefined =
  Platform.OS === 'ios' ? NativeModules.RNGeofencing : undefined;

/** Ask for "Always" location — required for killed-state geofence delivery. */
export function requestAlwaysPermission(): void {
  native?.requestAlwaysAuthorization();
}

/**
 * Replace the monitored set with these stashes. Native keeps the nearest 20 and
 * re-registers as the user moves. Passing `[]` stops all monitoring.
 */
export function setGeofences(stashes: GeofenceStash[]): void {
  native?.setGeofences(stashes);
}
