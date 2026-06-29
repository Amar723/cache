import {useEffect, useRef} from 'react';

import {useStashes} from './useStashes';
import {requestAlwaysPermission, setGeofences} from '../lib/geofencing';

/**
 * Keeps the native geofence set in lock-step with the user's unvisited stashes.
 *
 * Mounted once near the app root. Whenever the stash store changes (create,
 * edit, delete, mark-visited) we push the current unvisited places to the
 * native module, which monitors the nearest 20. When `enabled` is false (signed
 * out) we push an empty set, which stops all monitoring.
 */
export function useGeofenceSync(enabled: boolean): void {
  // Ask for "Always" location only once, and only when there's something to
  // monitor — pestering an empty account for background location is poor form.
  const askedPermission = useRef(false);
  const {stashes} = useStashes();

  useEffect(() => {
    const unvisited = enabled ? stashes.filter(s => s.visited_at == null) : [];

    if (enabled && unvisited.length > 0 && !askedPermission.current) {
      askedPermission.current = true;
      requestAlwaysPermission();
    }

    setGeofences(
      unvisited.map(s => ({
        id: s.id,
        name: s.place_name,
        lat: s.lat,
        lng: s.lng,
        openingHours: s.opening_hours,
      })),
    );
  }, [enabled, stashes]);
}
