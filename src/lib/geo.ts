import Geolocation, {
  type GeolocationResponse,
} from '@react-native-community/geolocation';

import type {LatLng} from './distance';

/**
 * One-shot current position as a Promise. Shared by the location hook and the
 * background proximity engine so both request coordinates the same way.
 */
export function getCurrentPosition(
  options?: Parameters<typeof Geolocation.getCurrentPosition>[2],
): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos: GeolocationResponse) => {
        resolve({lat: pos.coords.latitude, lng: pos.coords.longitude});
      },
      error => reject(error),
      options ?? {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 60000,
      },
    );
  });
}
