import {ActionSheetIOS, Linking, Platform} from 'react-native';

export interface DirectionsTarget {
  lat: number;
  lng: number;
  label: string;
}

/**
 * Both URLs below are universal links (apple.com / google.com), not custom
 * app schemes (maps:// / comgooglemaps://) — they open the native app when
 * it's installed and fall back to the browser otherwise, so there's no need
 * to probe installed apps first. Neither sets an origin, so each maps app
 * defaults to "current location" as the start point.
 */
export function appleMapsDirectionsUrl({
  lat,
  lng,
  label,
}: DirectionsTarget): string {
  return `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(
    label,
  )}&dirflg=d`;
}

export function googleMapsDirectionsUrl({lat, lng}: DirectionsTarget): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/**
 * Open turn-by-turn directions from the user's current location to a pin.
 * Android only ever has Google Maps as an option (Apple Maps doesn't exist
 * there), so it skips straight to it; iOS offers a native picker since both
 * apps are common there.
 */
export function openDirections(target: DirectionsTarget): void {
  if (Platform.OS !== 'ios') {
    Linking.openURL(googleMapsDirectionsUrl(target)).catch(() => {});
    return;
  }

  ActionSheetIOS.showActionSheetWithOptions(
    {
      options: ['Apple Maps', 'Google Maps', 'Cancel'],
      cancelButtonIndex: 2,
    },
    buttonIndex => {
      if (buttonIndex === 0) {
        Linking.openURL(appleMapsDirectionsUrl(target)).catch(() => {});
      } else if (buttonIndex === 1) {
        Linking.openURL(googleMapsDirectionsUrl(target)).catch(() => {});
      }
    },
  );
}
